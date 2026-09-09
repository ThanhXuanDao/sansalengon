import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";

// Affiliate API clients (từ sale-noti)
import { ShopeeAffiliateClient } from "./affiliate/shopee/client";
import { ShopeeRateLimitGuard } from "./affiliate/shopee/rate-limit-guard";
import { AccessTradePublisherClient } from "./affiliate/accesstrade/client";
import { AccessTradeRateLimitGuard } from "./affiliate/accesstrade/rate-limit-guard";

// Core services (mới build)
import { DealSyncService } from "./sync/deal-sync.service";
import { ContentGeneratorService } from "./distribute/content-generator.service";
import { ZaloBroadcastService } from "./distribute/zalo-broadcast.service";

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
  providers: [
    ...ObsStubs,
    ShopeeRateLimitGuard,
    ShopeeAffiliateClient,
    AccessTradeRateLimitGuard,
    AccessTradePublisherClient,
    DealSyncService,
    ContentGeneratorService,
    ZaloBroadcastService,
  ],
})
export class AppModule {}
