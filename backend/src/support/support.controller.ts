import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { SupportService } from './support.service';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { UpdateSupportTicketDto } from './dto/update-support-ticket.dto';
import { SupportTicket } from './entities/support-ticket.entity';

@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('tickets')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createDto: CreateSupportTicketDto): Promise<SupportTicket> {
    return this.supportService.create(createDto);
  }

  @Get('tickets')
  findAll(
    @Query('workspaceId') workspaceId?: string,
    @Query('userId') userId?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('category') category?: string,
  ): Promise<SupportTicket[]> {
    return this.supportService.findAll({
      workspaceId,
      userId,
      status,
      priority,
      category,
    });
  }

  @Get('tickets/stats')
  getStats(): Promise<Record<string, number>> {
    return this.supportService.countByStatus();
  }

  @Get('tickets/:id')
  findOne(@Param('id') id: string): Promise<SupportTicket> {
    return this.supportService.findOne(id);
  }

  @Patch('tickets/:id')
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateSupportTicketDto,
  ): Promise<SupportTicket> {
    return this.supportService.update(id, updateDto);
  }

  @Delete('tickets/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.supportService.remove(id);
  }
}
