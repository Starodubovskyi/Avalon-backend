import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MapPoint {
  @ApiProperty({
    type: String,
    example: 'cbcfa8b8-3a25-4adb-a9c6-e325f0d0f3ae',
  })
  id: string;

  @ApiProperty({
    type: Number,
    example: 1,
  })
  userId: number | string;

  @ApiProperty({
    type: Number,
    example: 45.42,
  })
  lat: number;

  @ApiProperty({
    type: Number,
    example: 28.2,
  })
  lng: number;

  @ApiProperty({
    type: String,
    example: 'Ion',
  })
  firstName: string;

  @ApiProperty({
    type: String,
    example: 'Popescu',
  })
  lastName: string;

  @ApiProperty({
    type: String,
    example: 'Port agent',
  })
  activity: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
  })
  phone: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
  })
  email: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
  })
  address: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'cbcfa8b8-3a25-4adb-a9c6-e325f0d0f3ae',
  })
  photoId: string | null;

  @ApiProperty({
    type: Boolean,
  })
  isFavorite: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional()
  deletedAt?: Date | null;
}
