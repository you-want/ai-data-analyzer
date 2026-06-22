import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { Repository } from 'typeorm';
import { KnowledgeChunk } from './entities/knowledge-chunk.entity';
import { TenantRlsService } from '../tenant/tenant-rls.service';

interface IngestReportInput {
  workspaceId: string;
  analysisId?: string;
  datasetId?: string;
  report: string;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeQueryResult {
  chunkId: string;
  chunkType: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
}

@Injectable()
export class KnowledgeBaseService {
  constructor(
    @InjectRepository(KnowledgeChunk)
    private readonly chunksRepository: Repository<KnowledgeChunk>,
    private readonly tenantRlsService: TenantRlsService,
  ) {}

  async ingestReport(input: IngestReportInput): Promise<KnowledgeChunk[]> {
    return this.tenantRlsService.runWithTenant(
      { workspaceId: input.workspaceId },
      async (manager) => {
        const chunksRepository = manager.getRepository(KnowledgeChunk);
        const chunks = this.chunkReport(input.report);
        const hashes = chunks.map((content) => this.buildContentHash(content));

        const existing = await this.findExistingChunks(
          chunksRepository,
          input.workspaceId,
          hashes,
        );
        const existingHashes = new Set(
          existing
            .map((item) => item.contentHash)
            .filter((value): value is string => Boolean(value)),
        );

        const entities = chunks
          .map((content, index) => ({
            content,
            index,
            contentHash: hashes[index],
          }))
          .filter((item) => !existingHashes.has(item.contentHash))
          .map((item) =>
            chunksRepository.create({
              workspaceId: input.workspaceId,
              datasetId: input.datasetId,
              analysisId: input.analysisId,
              chunkType: 'report',
              content: item.content,
              contentHash: item.contentHash,
              embedding: this.embed(item.content),
              metadata: {
                chunkIndex: item.index,
                embeddingProvider: 'local-hash',
                ...(input.metadata ?? {}),
              },
            }),
          );

        if (entities.length === 0) {
          return [];
        }

        return chunksRepository.save(entities);
      },
    );
  }

  async query(
    workspaceId: string,
    query: string,
    topK = 5,
  ): Promise<KnowledgeQueryResult[]> {
    return this.tenantRlsService.runWithTenant(
      { workspaceId },
      async (manager) => {
        const chunks = await manager.getRepository(KnowledgeChunk).find({
          where: { workspaceId },
          order: { createdAt: 'DESC' },
          take: 300,
        });

        const queryEmbedding = this.embed(query);
        const queryTokens = this.tokenize(query);

        return chunks
          .map((chunk) => {
            const semanticScore = this.cosineSimilarity(
              queryEmbedding,
              chunk.embedding,
            );
            const lexicalScore = this.computeLexicalScore(
              queryTokens,
              chunk.content,
            );
            const freshnessScore = this.computeFreshnessScore(chunk.createdAt);
            const score =
              semanticScore * 0.65 + lexicalScore * 0.25 + freshnessScore * 0.1;

            return {
              chunkId: chunk.id,
              chunkType: chunk.chunkType,
              content: chunk.content,
              metadata: {
                ...chunk.metadata,
                analysisId: chunk.analysisId,
                datasetId: chunk.datasetId,
              },
              score,
            };
          })
          .filter((item) => item.score > 0.025)
          .sort((left, right) => right.score - left.score)
          .slice(0, topK);
      },
    );
  }

  buildContextPack(items: KnowledgeQueryResult[]): string {
    return items
      .map((item, index) => {
        const analysisId = this.formatMetadataValue(item.metadata.analysisId);
        const datasetId = this.formatMetadataValue(item.metadata.datasetId);
        return `[C${index + 1} | type=${item.chunkType} | score=${item.score.toFixed(
          3,
        )} | analysis=${analysisId} | dataset=${datasetId}]\n${item.content}`;
      })
      .join('\n\n');
  }

  private embed(text: string): number[] {
    const dims = 64;
    const vector = Array.from({ length: dims }, () => 0);
    const tokens = text
      .toLowerCase()
      .split(/[^\p{L}\p{N}_]+/u)
      .filter(Boolean);

    for (const token of tokens) {
      let hash = 0;
      for (const char of token) {
        hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
      }
      vector[hash % dims] += 1;
    }

    const magnitude =
      Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
    return vector.map((value) => value / magnitude);
  }

  private cosineSimilarity(left: number[], right: number[]): number {
    const size = Math.min(left.length, right.length);
    let score = 0;
    for (let index = 0; index < size; index += 1) {
      score += (left[index] ?? 0) * (right[index] ?? 0);
    }
    return score;
  }

  private async findExistingChunks(
    repository: Repository<KnowledgeChunk>,
    workspaceId: string,
    hashes: string[],
  ) {
    if (hashes.length === 0) {
      return [];
    }

    return repository.find({
      where: hashes.map((contentHash) => ({
        workspaceId,
        contentHash,
      })),
      select: {
        id: true,
        contentHash: true,
      },
    });
  }

  private chunkReport(report: string): string[] {
    const paragraphs = report
      .split(/\n{2,}/)
      .map((chunk) => chunk.trim())
      .filter(Boolean);

    return paragraphs.flatMap((paragraph) => this.splitLongChunk(paragraph));
  }

  private splitLongChunk(content: string): string[] {
    if (content.length <= 900) {
      return [content];
    }

    const sentences = content
      .split(/(?<=[。！？.!?])\s+/)
      .map((part) => part.trim())
      .filter(Boolean);

    const chunks: string[] = [];
    let current = '';
    for (const sentence of sentences) {
      if (!current) {
        current = sentence;
        continue;
      }

      if (`${current} ${sentence}`.length > 900) {
        chunks.push(current);
        current = sentence;
        continue;
      }

      current = `${current} ${sentence}`;
    }

    if (current) {
      chunks.push(current);
    }

    return chunks.length > 0 ? chunks : [content];
  }

  private buildContentHash(content: string): string {
    return createHash('sha256')
      .update(this.normalizeText(content))
      .digest('hex');
  }

  private normalizeText(input: string): string {
    return input.trim().replace(/\s+/g, ' ').toLowerCase();
  }

  private tokenize(input: string): string[] {
    return this.normalizeText(input)
      .split(/[^\p{L}\p{N}_]+/u)
      .filter((token) => token.length > 1);
  }

  private computeLexicalScore(queryTokens: string[], content: string): number {
    if (queryTokens.length === 0) {
      return 0;
    }

    const contentTokens = new Set(this.tokenize(content));
    let matched = 0;
    for (const token of queryTokens) {
      if (contentTokens.has(token)) {
        matched += 1;
      }
    }

    return matched / queryTokens.length;
  }

  private computeFreshnessScore(createdAt: Date): number {
    const ageMs = Math.max(0, Date.now() - createdAt.getTime());
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    return Math.max(0, 1 - ageMs / (weekMs * 12));
  }

  private formatMetadataValue(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }
    if (
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint'
    ) {
      return value.toString();
    }
    if (value == null) {
      return 'n/a';
    }
    return JSON.stringify(value);
  }
}
