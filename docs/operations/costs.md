# Chi phí vận hành
*Last updated: 2026-09-10*

## Giai đoạn 1 — Khởi động (Tháng 1–2)

| Hạng mục | Chi phí/tháng | Ghi chú |
|---|---|---|
| VPS (2 vCPU, 4GB RAM) | 300–500k | Vultr / DigitalOcean / Railway |
| Domain .com | ~20k | Tính trung bình theo năm (~$10/năm) |
| Cloudflare R2 (lưu ảnh) | 0 | Free tier 10GB |
| AI (Gemini Flash) | **0** | Free 1M tokens/ngày — đủ dùng |
| AI (OpenAI embedding) | **<$0.01** | $0.02/1M tokens — gần miễn phí, chỉ khi dùng matching |
| **Tổng kỹ thuật** | **~350–550k** | |

> **Không cần Redis** — cron dùng `@nestjs/schedule` built-in.
> **Không cần BullMQ** — không có queue, sync chạy trực tiếp trong cron.

## Giai đoạn 2 — Mở rộng (Tháng 3–6)

| Hạng mục | Chi phí/tháng | Ghi chú |
|---|---|---|
| VPS (nâng cấp) | 500–800k | Khi traffic tăng |
| Zalo OA API | ~1,000k | Bắt buộc để broadcast mass |
| AI (nếu dùng Claude/OpenAI) | 50–200k | Tùy volume; Gemini vẫn miễn phí |
| Cộng tác viên post FB | 1,000–2,000k | Nếu cần |
| **Tổng** | **~2.5–4tr** | |

## Chi phí AI chi tiết

| Provider | Task | Chi phí ước tính |
|---|---|---|
| **Gemini Flash** (khuyên dùng) | Post gen, blog, SEO, sentiment, auto-classify | **$0** (free 1M tokens/ngày) |
| **DeepSeek Chat** | Backup cho Gemini | ~$0.14/1M tokens ≈ <10k/tháng |
| **OpenAI** `text-embedding-3-small` | Embedding matching (weekly cron) | $0.02/1M tokens ≈ **<$0.01/tháng** (gần miễn phí) |
| **OpenAI** `gpt-4o-mini` | Post gen / blog (nếu chọn) | $0.15/1M tokens |
| **DALL-E 3** | Deal image gen | $0.04/image |
| **Claude Haiku** | Post gen quality mode | $0.80/1M tokens |

**Kịch bản khuyên dùng:** Gemini Flash + OpenAI embedding = **<$0.01/tháng** tổng AI cost — gần như miễn phí hoàn toàn.

## ROI ước tính

```
Giai đoạn 2 (tháng 3–6):
  Chi phí:     ~3tr/tháng
  Hoa hồng:    5–20tr/tháng
  Lợi nhuận:   2–17tr/tháng
  ROI:         67%–567%
```

## Không có chi phí

- AccessTrade: **miễn phí** đăng ký, hưởng hoa hồng
- Shopee Affiliate: **miễn phí**
- Tiki / Lazada Affiliate: **miễn phí**
- Gemini Flash AI: **miễn phí** (1M tokens/ngày)
- Next.js / NestJS / Prisma: open source
- PostgreSQL: open source
- `@nestjs/schedule` cron: built-in, không cần Redis/BullMQ
