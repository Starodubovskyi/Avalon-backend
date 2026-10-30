import { ApiProperty } from '@nestjs/swagger';

export class AisStatus {
  @ApiProperty({
    type: Boolean,
    description: 'false when AISSTREAM_API_KEY is empty',
  })
  enabled: boolean;

  @ApiProperty({ type: Boolean })
  connected: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastMessageAt: string | null;

  @ApiProperty({
    type: Number,
    description: 'Active (not departed) vessels with an IMO or MMSI to match',
  })
  trackedVessels: number;
}
