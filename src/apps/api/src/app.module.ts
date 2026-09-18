import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";

// Affiliate API clients
import { ShopeeAffiliateClient } from "./affiliate/shopee/client";
import { ShopeeRateLimitGuard } from "./affiliate/shopee/rate-limit-guard";
import { AccessTradePublisherClient } from "./affiliate/accesstrade/client";
import { AccessTradeRateLimitGuard } from "./affiliate/accesstrade/rate-limit-guard";

// Core sync services
import { DealSyncService } from "./sync/deal-sync.service";
import { CouponSyncService } from "./sync/coupon-sync.service";
import { SyncController } from "./sync/sync.controller";
import { PricePredictionService } from "./sync/price-prediction.service";
import { ContentGeneratorService } from "./distribute/content-generator.service";
import { ZaloTokenService } from "./distribute/zalo-token.service";
import { ZaloBroadcastService } from "./distribute/zalo-broadcast.service";

// Multi-platform comparison
import { ShopeeAdapter } from "./platforms/shopee/shopee.adapter";
import { LazadaAdapter } from "./platforms/lazada/lazada.adapter";
import { TikiAdapter } from "./platforms/tiki/tiki.adapter";
import { ProductMatcherService } from "./platforms/matcher/product-matcher.service";
import { EmbeddingService } from "./platforms/matcher/embedding.service";
import { PlatformSyncService } from "./platforms/platform-sync.service";
import { PlatformAdapter } from "./platforms/platform.adapter";

import { AppLogService } from "./shared/app-log.service"
import { ScraperSyncService } from "./scraper/scraper-sync.service";

// Stub observability — thay bằng Sentry thật khi cần
const ObsStubs = [
  { provide: "OBS_SENTRY", useValue: { captureException: () => {}, captureMessage: () => {}, addBreadcrumb: () => {} } },
  { provide: "OBS_POSTHOG", useValue: { capture: () => {} } },
];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
  ],
  controllers: [SyncController],
  providers: [
    ...ObsStubs,

    // Shopee
    ShopeeRateLimitGuard,
    ShopeeAffiliateClient,

    // AccessTrade
    AccessTradeRateLimitGuard,
    AccessTradePublisherClient,

    // Shared
    AppLogService,

    // Core sync
    DealSyncService,
    ScraperSyncService,
    CouponSyncService,
    PricePredictionService,
    ContentGeneratorService,
    ZaloTokenService,
    ZaloBroadcastService,

    // Platform adapters — registered individually AND under abstract token
    ShopeeAdapter,
    LazadaAdapter,
    TikiAdapter,
    {
      // Inject all three as an array: inject([PlatformAdapter]) in PlatformSyncService
      provide: PlatformAdapter,
      useFactory: (s: ShopeeAdapter, l: LazadaAdapter, t: TikiAdapter) => [s, l, t],
      inject: [ShopeeAdapter, LazadaAdapter, TikiAdapter],
    },

    // Matching + sync
    EmbeddingService,
    ProductMatcherService,
    PlatformSyncService,
  ],
})
export class AppModule {}
