import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SupportTicket } from './entities/support-ticket.entity';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { UpdateSupportTicketDto } from './dto/update-support-ticket.dto';

@Injectable()
export class SupportService {
  constructor(
    @InjectRepository(SupportTicket)
    private readonly ticketRepository: Repository<SupportTicket>,
  ) {}

  async create(createDto: CreateSupportTicketDto): Promise<SupportTicket> {
    const ticket = this.ticketRepository.create(createDto);
    return this.ticketRepository.save(ticket);
  }

  async findAll(
    filters?: Partial<{
      workspaceId: string;
      userId: string;
      status: string;
      priority: string;
      category: string;
    }>,
  ): Promise<SupportTicket[]> {
    const query = this.ticketRepository.createQueryBuilder('ticket');

    if (filters?.workspaceId) {
      query.where('ticket.workspaceId = :workspaceId', {
        workspaceId: filters.workspaceId,
      });
    }
    if (filters?.userId) {
      query.where('ticket.userId = :userId', { userId: filters.userId });
    }
    if (filters?.status) {
      query.andWhere('ticket.status = :status', { status: filters.status });
    }
    if (filters?.priority) {
      query.andWhere('ticket.priority = :priority', {
        priority: filters.priority,
      });
    }
    if (filters?.category) {
      query.andWhere('ticket.category = :category', {
        category: filters.category,
      });
    }

    query.orderBy('ticket.createdAt', 'DESC');
    return query.getMany();
  }

  async findOne(id: string): Promise<SupportTicket> {
    const ticket = await this.ticketRepository.findOneBy({ id });
    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${id} not found`);
    }
    return ticket;
  }

  async update(
    id: string,
    updateDto: UpdateSupportTicketDto,
  ): Promise<SupportTicket> {
    const ticket = await this.findOne(id);
    Object.assign(ticket, updateDto);
    return this.ticketRepository.save(ticket);
  }

  async remove(id: string): Promise<void> {
    const result = await this.ticketRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Ticket with ID ${id} not found`);
    }
  }

  async countByStatus(): Promise<Record<string, number>> {
    const result = await this.ticketRepository
      .createQueryBuilder('ticket')
      .select('ticket.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('ticket.status')
      .getRawMany<{ status: string; count: string }>();

    return result.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = parseInt(row.count, 10);
      return acc;
    }, {});
  }
}
