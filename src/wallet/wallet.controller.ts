import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import { toNetworkActor } from '../users-directory/user-visibility';
import {
  TopUpRequest,
  WalletAccount,
  WalletSummary,
  WalletTransaction,
} from './domain/wallet';
import { CreateTopUpRequestDto } from './dto/create-top-up-request.dto';
import { CreateWalletCreditDto } from './dto/create-wallet-credit.dto';
import { QueryTopUpRequestsDto } from './dto/query-top-up-requests.dto';
import { QueryWalletAccountsDto } from './dto/query-wallet-accounts.dto';
import { WalletService } from './wallet.service';

type AuthRequest = { user: JwtPayloadType };

/** Virtual credits: the caller's wallet, plus the admin side. */
@ApiTags('Wallet')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({
  path: 'wallet',
  version: '1',
})
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  @ApiOkResponse({
    type: WalletSummary,
    description:
      'Balance, latest 50 transactions, prices, pending top-up, active RANK boosts',
  })
  @HttpCode(HttpStatus.OK)
  getSummary(@Request() request: AuthRequest): Promise<WalletSummary> {
    return this.walletService.getSummary(toNetworkActor(request.user));
  }

  @Post('top-up-requests')
  @ApiCreatedResponse({ type: TopUpRequest })
  @ApiUnprocessableEntityResponse({
    description:
      '{ errors: { amount: "pendingExists" | "invalid", note: "tooLong" } }',
  })
  @HttpCode(HttpStatus.CREATED)
  createTopUpRequest(
    @Request() request: AuthRequest,
    @Body() dto: CreateTopUpRequestDto,
  ): Promise<TopUpRequest> {
    return this.walletService.createTopUpRequest(
      toNetworkActor(request.user),
      dto,
    );
  }

  @Get('top-up-requests')
  @Roles(RoleEnum.admin)
  @ApiOkResponse({
    type: [TopUpRequest],
    description: 'Admin only. Newest first, at most 200',
  })
  @ApiForbiddenResponse()
  @HttpCode(HttpStatus.OK)
  findTopUpRequests(
    @Query() query: QueryTopUpRequestsDto,
  ): Promise<TopUpRequest[]> {
    return this.walletService.findTopUpRequests(query);
  }

  @Post('top-up-requests/:id/approve')
  @Roles(RoleEnum.admin)
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({
    type: TopUpRequest,
    description: 'Admin only. Credits the amount (kind top_up)',
  })
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiUnprocessableEntityResponse({
    description: '{ errors: { status: "alreadyHandled" } }',
  })
  @HttpCode(HttpStatus.OK)
  approveTopUpRequest(
    @Request() request: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<TopUpRequest> {
    return this.walletService.approveTopUpRequest(
      id,
      toNetworkActor(request.user),
    );
  }

  @Post('top-up-requests/:id/decline')
  @Roles(RoleEnum.admin)
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: TopUpRequest, description: 'Admin only' })
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiUnprocessableEntityResponse({
    description: '{ errors: { status: "alreadyHandled" } }',
  })
  @HttpCode(HttpStatus.OK)
  declineTopUpRequest(
    @Request() request: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<TopUpRequest> {
    return this.walletService.declineTopUpRequest(
      id,
      toNetworkActor(request.user),
    );
  }

  @Post('credits')
  @Roles(RoleEnum.admin)
  @ApiCreatedResponse({
    type: WalletTransaction,
    description:
      'Admin only. amount > 0 → kind top_up; amount < 0 → kind adjustment',
  })
  @ApiForbiddenResponse()
  @ApiUnprocessableEntityResponse({
    description:
      '{ errors: { userId: "notFound" | "invalid", amount: "invalid", balance: "insufficient" } }',
  })
  @HttpCode(HttpStatus.CREATED)
  credit(
    @Request() request: AuthRequest,
    @Body() dto: CreateWalletCreditDto,
  ): Promise<WalletTransaction> {
    return this.walletService.credit(dto, toNetworkActor(request.user));
  }

  @Get('accounts')
  @Roles(RoleEnum.admin)
  @ApiOkResponse({
    type: [WalletAccount],
    description: 'Admin only. Active users with balances, at most 100',
  })
  @ApiForbiddenResponse()
  @HttpCode(HttpStatus.OK)
  findAccounts(
    @Query() query: QueryWalletAccountsDto,
  ): Promise<WalletAccount[]> {
    return this.walletService.findAccounts(query.search);
  }

  @Post('rank-boost')
  @ApiOkResponse({
    type: WalletSummary,
    description: '-100 credits → +250 RANK for 30 days',
  })
  @ApiUnprocessableEntityResponse({
    description: '{ errors: { balance: "insufficient" } }',
  })
  @HttpCode(HttpStatus.OK)
  boostRank(@Request() request: AuthRequest): Promise<WalletSummary> {
    return this.walletService.boostRank(toNetworkActor(request.user));
  }
}
