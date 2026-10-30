import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { Port } from './domain/port';
import { CreatePortDto } from './dto/create-port.dto';
import { QueryPortDto } from './dto/query-port.dto';
import { UpdatePortDto } from './dto/update-port.dto';
import { PortRepository } from './infrastructure/persistence/port.repository';
import { PortOperationalStatus, normalizeUnlocode } from './port-status.enum';

function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }
  const driverError = error.driverError as { code?: string } | undefined;
  return driverError?.code === '23505';
}

function unlocodeConflict(): ConflictException {
  return new ConflictException({
    status: 409,
    errors: { unlocode: 'alreadyExists' },
  });
}

function normalizeCountry(raw?: string): string | null {
  const value = raw?.trim();
  if (!value) {
    return null;
  }
  return value.length <= 2 ? value.toUpperCase() : value;
}

@Injectable()
export class PortsService {
  constructor(private readonly portsRepository: PortRepository) {}

  async create(dto: CreatePortDto): Promise<Port> {
    const unlocode = normalizeUnlocode(dto.unlocode);
    if (!unlocode) {
      throw new UnprocessableEntityException({
        status: 422,
        errors: { unlocode: 'UN/LOCODE must be 5 characters (AA + 3)' },
      });
    }

    const existing = await this.portsRepository.findByUnlocode(unlocode);
    if (existing) {
      throw unlocodeConflict();
    }

    try {
      return await this.portsRepository.create({
        name: dto.name,
        unlocode,
        country: normalizeCountry(dto.country),
        status: dto.status ?? PortOperationalStatus.OPEN,
        timezone: dto.timezone?.trim() || 'UTC',
        lat: typeof dto.lat === 'number' ? dto.lat : null,
        lng: typeof dto.lng === 'number' ? dto.lng : null,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw unlocodeConflict();
      }
      throw error;
    }
  }

  findAll(query: QueryPortDto): Promise<Port[]> {
    return this.portsRepository.findAll({
      search: query.search,
      status: query.status,
      page: query.page ?? 1,
      limit: query.limit ?? 50,
    });
  }

  async findById(id: Port['id']): Promise<Port> {
    const port = await this.portsRepository.findById(id);
    if (!port) {
      throw new NotFoundException('Port not found');
    }
    return port;
  }

  async update(id: Port['id'], dto: UpdatePortDto): Promise<Port> {
    const current = await this.findById(id);
    let unlocode = current.unlocode;

    if (dto.unlocode) {
      const nextCode = normalizeUnlocode(dto.unlocode);
      if (!nextCode) {
        throw new UnprocessableEntityException({
          status: 422,
          errors: { unlocode: 'UN/LOCODE must be 5 characters (AA + 3)' },
        });
      }
      if (nextCode !== current.unlocode) {
        const clash = await this.portsRepository.findByUnlocode(nextCode);
        if (clash && clash.id !== id) {
          throw unlocodeConflict();
        }
        unlocode = nextCode;
      }
    }

    try {
      const updated = await this.portsRepository.update(id, {
        name: dto.name,
        unlocode,
        country:
          dto.country === undefined ? undefined : normalizeCountry(dto.country),
        status: dto.status,
        timezone: dto.timezone,
        lat: dto.lat,
        lng: dto.lng,
      });

      if (!updated) {
        throw new NotFoundException('Port not found');
      }

      return updated;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw unlocodeConflict();
      }
      throw error;
    }
  }

  async remove(id: Port['id']): Promise<void> {
    const removed = await this.portsRepository.remove(id);
    if (!removed) {
      throw new NotFoundException('Port not found');
    }
  }
}
