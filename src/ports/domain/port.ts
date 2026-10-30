import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PortOperationalStatus } from '../port-status.enum';

export class Port {
  @ApiProperty({
    type: String,
    example: 'cbcfa8b8-3a25-4adb-a9c6-e325f0d0f3ae',
  })
  id: string;

  @ApiProperty({
    type: String,
    example: 'Constanța',
  })
  name: string;

  @ApiProperty({
    type: String,
    example: 'ROCND',
  })
  unlocode: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'RO',
  })
  country: string | null;

  @ApiProperty({
    enum: PortOperationalStatus,
    example: PortOperationalStatus.OPEN,
  })
  status: PortOperationalStatus;

  @ApiProperty({
    type: String,
    example: 'Europe/Bucharest',
  })
  timezone: string;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 44.1598,
  })
  lat: number | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 28.6348,
  })
  lng: number | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional()
  deletedAt?: Date | null;
}
