import { DeepPartial } from '../../../utils/types/deep-partial.type';
import { NullableType } from '../../../utils/types/nullable.type';
import { Port } from '../../domain/port';
import { PortOperationalStatus } from '../../port-status.enum';

export type PortListFilter = {
  search?: string;
  status?: PortOperationalStatus;
  page: number;
  limit: number;
};

export abstract class PortRepository {
  abstract create(
    data: Omit<Port, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
  ): Promise<Port>;

  abstract findAll(filter: PortListFilter): Promise<Port[]>;

  abstract findById(id: Port['id']): Promise<NullableType<Port>>;

  abstract findByUnlocode(unlocode: string): Promise<NullableType<Port>>;

  abstract update(
    id: Port['id'],
    payload: DeepPartial<Port>,
  ): Promise<Port | null>;

  abstract remove(id: Port['id']): Promise<boolean>;
}
