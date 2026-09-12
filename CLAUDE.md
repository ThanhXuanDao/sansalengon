# CLAUDE.md — Affiliate Project

## Critical constraints

- **Schema**: project chưa chạy lần nào — luôn sửa trực tiếp `prisma/schema.prisma`, KHÔNG tạo migration script hay ALTER TABLE.
- **Git**: KHÔNG auto-commit — để user quyết định khi nào commit.

---

## No-Hardcode Rule

### CSS / Styling

**Inline `style={}` chỉ được dùng cho giá trị động tính toán runtime.**
Ví dụ hợp lệ: `style={{ width: `${pct}%` }}`, `style={{ background: dynamicColor }}`.

**Giá trị tĩnh phải dùng Tailwind class hoặc CSS utility class — không được dùng `style={}`.**

#### Clip-path — dùng các utility class đã định nghĩa trong `globals.css`:

| Class | Mô tả |
|---|---|
| `.clip-bevel-xs` | 6px — cắt góc trên-trái và dưới-phải |
| `.clip-bevel-sm` | 8px — cắt góc trên-trái và dưới-phải |
| `.clip-bevel-md` | 10px — cắt góc trên-trái và dưới-phải |
| `.clip-bevel-lg` | 12px — cắt góc trên-trái và dưới-phải |
| `.clip-bevel-xl` | 16px — cắt góc trên-trái và dưới-phải |
| `.clip-bevel-2xl` | 24px — cắt góc trên-trái và dưới-phải |
| `.clip-bevel-tl-sm` | 10px — cắt góc trên-trái |
| `.clip-bevel-tr-md` | 12px — cắt góc trên-phải |
| `.clip-bevel-tr-lg` | 14px — cắt góc trên-phải |
| `.clip-bevel-tr-xl` | 16px — cắt góc trên-phải |

#### Các utility khác:

| Thay vì | Dùng |
|---|---|
| `style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}` | class `.scrollbar-hide` |
| `style={{ fontVariantNumeric: "tabular-nums" }}` | Tailwind class `tabular-nums` |
| `style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}` | class `.navbar-shadow` |
| `style={{ flexShrink: 0 }}` | Tailwind class `shrink-0` |
| `style={{ background: "white" }}` | Tailwind class `bg-white` |
| `style={{ display: "none", visibility: "hidden" }}` | Tailwind classes `hidden invisible` |
| `style={{ height: 100 }}` | Tailwind class `h-[100px]` |
| `style={{ minHeight: 112 }}` | Tailwind class `min-h-[112px]` |

#### Màu sắc:

Các màu dùng nhiều lần phải được định nghĩa trong `@theme` block của `globals.css` hoặc Tailwind config. Không dùng hex code trực tiếp trong arbitrary values nếu màu đó xuất hiện hơn 3 lần trong codebase.

### Code / Logic

- Không dùng magic string hoặc magic number trong business logic — đặt vào named constant.
- Không hardcode URL, endpoint, hay config — dùng env var hoặc config file.
- Không hardcode credential, token, hay secret bất kỳ đâu trong code.

---

## Project structure

- **Framework**: Next.js 15 App Router, TypeScript strict
- **Styling**: Tailwind CSS v4, globals ở `src/app/globals.css`
- **Auth**: custom JWT session (`sansale_admin_session` cookie, HS256, `SESSION_SECRET`)
- **DB**: PostgreSQL via Prisma v5 — dùng `npx prisma@5` khi chạy CLI
- **Docker**: `src/apps/web/Dockerfile.local`, compose ở project root
