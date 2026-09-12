# Hướng dẫn Deploy lên Server
*Last updated: 2026-09-10*

Hệ thống gồm **2 app** cần chạy cùng lúc:
- **`apps/web`** — Next.js 15 (port 3000) — website + admin
- **`apps/api`** — NestJS (port 4000) — cron sync, broadcast, matching

Cả hai **dùng chung 1 PostgreSQL database**.

---

## 0. Docker Local — Test nhanh tại máy tính của bạn

> Dùng khi muốn chạy toàn bộ hệ thống (web + api + DB) tại local để test UI và tính năng mà không cần cài Node, PostgreSQL thủ công.

### 0.1 Yêu cầu

- **Docker Desktop** đã cài và đang chạy
  - Windows: https://docs.docker.com/desktop/install/windows-install/
  - Mac: https://docs.docker.com/desktop/install/mac-install/
- Không cần cài Node.js, PostgreSQL, hay bất kỳ gì khác

### 0.2 Chuẩn bị file env

Tạo file `.env.local` ở thư mục gốc repo (cạnh `docker-compose.local.yml`):

```bash
# .env.local — chỉ dùng cho Docker local, KHÔNG commit lên git
DATABASE_URL=postgresql://affiliate:secret@postgres:5432/affiliate
NEXT_PUBLIC_SITE_URL=http://localhost:3000
WEB_URL=http://localhost:3000
NODE_ENV=production

# Internal API (Web → NestJS) — trong Docker, API_URL bị override thành http://api:4000
# Để trống API_INTERNAL_SECRET = không cần auth (ok cho local dev)
API_URL=http://localhost:4000
API_INTERNAL_SECRET=

# Điền key nếu muốn test tính năng đó, để trống nếu không cần
ACCESSTRADE_ACCESS_KEY=
SHOPEE_AFFILIATE_APP_ID=
SHOPEE_AFFILIATE_APP_SECRET=
GOOGLE_AI_API_KEY=
OPENAI_API_KEY=
ZALO_OA_ACCESS_TOKEN=
ZALO_OA_APP_ID=
ZALO_OA_APP_SECRET=

# Admin password (đặt tùy ý để đăng nhập /admin)
ADMIN_PASSWORD_HASH=
```

> Để trống key nào thì tính năng đó sẽ tự động bị skip — app vẫn chạy bình thường.

### 0.3 Khởi động

```bash
# Lần đầu — build image và chạy (mất 2-5 phút)
docker compose -f docker-compose.local.yml up --build

# Lần sau — đã có image, khởi động nhanh hơn
docker compose -f docker-compose.local.yml up
```

Sau khi thấy log:
```
web_1  | ✓ Ready on http://localhost:3000
api_1  | [NestJS] Application is running on port 4000
```

Mở trình duyệt:
- **Website:** http://localhost:3000
- **Admin:** http://localhost:3000/admin
- **API health:** http://localhost:4000/health

### 0.4 Khởi tạo database (chỉ làm 1 lần)

```bash
# Mở terminal mới, chạy schema.sql vào container postgres
docker compose -f docker-compose.local.yml exec postgres \
  psql -U affiliate -d affiliate -f /docker-entrypoint-initdb.d/schema.sql
```

> Nếu đã mount schema.sql vào `docker-entrypoint-initdb.d/` thì PostgreSQL tự chạy khi container tạo lần đầu — không cần bước này.

### 0.5 Thêm dữ liệu test thủ công

Vào admin để thêm sản phẩm/coupon test:

```bash
# Mở psql shell để insert trực tiếp
docker compose -f docker-compose.local.yml exec postgres psql -U affiliate -d affiliate
```

```sql
-- Thêm coupon test
INSERT INTO "Coupon" (id, source, merchant, code, description, "discountValue", "discountType", "affiliateUrl", "isActive")
VALUES ('test-coupon-1', 'manual', 'Shopee', 'GIAM50K', 'Giảm 50k cho đơn từ 200k', 50000, 'fixed', 'https://shopee.vn', true);
```

### 0.6 Trigger sync thủ công (không cần đợi cron)

Dùng **Admin → Sync Jobs** để chạy từng job ngay lập tức:

1. Mở http://localhost:3000/admin/jobs
2. Chọn job trong sidebar: **Đồng bộ sản phẩm**, **Đồng bộ Coupon/Voucher**, hoặc **Khớp nền tảng**
3. (Tùy chọn) Điều chỉnh config (ngách, nguồn) nếu cần
4. Nhấn **Chạy ngay** — kết quả hiển thị real-time ngay bên dưới

```bash
# Theo dõi log chi tiết của api trong khi job chạy
docker compose -f docker-compose.local.yml logs -f api
```

> Trong Sync Jobs cũng có thể cấu hình **lịch chạy tự động** (bật/tắt toggle + chọn tần suất) cho từng job.

### 0.7 Các lệnh hữu ích

```bash
# Xem log realtime của tất cả service
docker compose -f docker-compose.local.yml logs -f

# Chỉ xem log web
docker compose -f docker-compose.local.yml logs -f web

# Chỉ xem log api (cron jobs, sync)
docker compose -f docker-compose.local.yml logs -f api

# Vào shell của container web
docker compose -f docker-compose.local.yml exec web sh

# Vào shell của container api
docker compose -f docker-compose.local.yml exec api sh

# Restart một service (sau khi sửa code và build lại)
docker compose -f docker-compose.local.yml restart web
docker compose -f docker-compose.local.yml restart api

# Dừng tất cả (giữ nguyên dữ liệu DB)
docker compose -f docker-compose.local.yml stop

# Dừng và XÓA toàn bộ (kể cả DB data) — reset hoàn toàn
docker compose -f docker-compose.local.yml down -v

# Build lại image sau khi sửa code
docker compose -f docker-compose.local.yml up --build
```

### 0.8 Test từng tính năng

| Tính năng | Cách test |
|---|---|
| Trang chủ & sản phẩm | Mở http://localhost:3000 |
| Admin dashboard | http://localhost:3000/admin → đăng nhập |
| Coupon page | http://localhost:3000/ma-giam-gia |
| Thêm coupon thủ công | Admin → Coupons → thêm form |
| Sync Jobs | Admin → Sync Jobs → chọn job → Chạy ngay |
| Đồng bộ sản phẩm | Sync Jobs → Đồng bộ sản phẩm → chọn ngách → Chạy ngay |
| Đồng bộ Coupon/Voucher | Sync Jobs → Đồng bộ Coupon/Voucher → Chạy ngay |
| Xem AI config | Admin → AI Config |
| Generate blog | Admin → AI Blog → chọn ngách → Generate |
| Affiliate redirect | http://localhost:3000/api/affiliate/redirect/[product-id] |
| Health check | http://localhost:4000/health |
| DB trực tiếp | `docker compose -f docker-compose.local.yml exec postgres psql -U affiliate -d affiliate` |

### 0.9 Sửa code và test lại

Docker local chạy **production build** (không có hot reload). Sau khi sửa code:

```bash
# Rebuild và restart service đó
docker compose -f docker-compose.local.yml up --build web
# hoặc
docker compose -f docker-compose.local.yml up --build api
```

> Nếu muốn hot reload khi dev, dùng `npm run dev` trực tiếp (không qua Docker) với PostgreSQL chạy bằng Docker riêng — xem hướng dẫn trong [setup-guide.md](setup-guide.md).

---

## Chọn phương án deploy lên server

| Phương án | Chi phí | Độ khó | Phù hợp |
|---|---|---|---|
| [A. Railway (full)](#a-railway---miễn-phí-khuyên-dùng-cho-demo) | Miễn phí ($5 credit) | ⭐ Dễ nhất | Test, demo |
| [B. Vercel + Railway](#b-vercel-web--railway-api--db) | ~$5–10/tháng | ⭐⭐ Dễ | Production nhỏ |
| [C. Render + Neon](#c-render-web--api--neon-db) | Miễn phí (có giới hạn) | ⭐⭐ Dễ | Dev/test (cron không ổn định) |
| [D. VPS tự quản lý](#d-vps-tự-quản-lý---khuyên-dùng-khi-có-traffic) | $4–15/tháng | ⭐⭐⭐ Trung bình | Production thực tế |
| [E. Docker Compose trên VPS](#e-docker-compose-trên-vps) | $4–15/tháng | ⭐⭐⭐ Trung bình | Production có cấu trúc |

> **Lưu ý quan trọng:** NestJS chạy **Cron job** liên tục (sync 4h, coupon 6h/18h, Zalo 9h sáng). Cần server **luôn chạy** — không dùng được serverless function hay free tier bị sleep (Render free).

---

## A. Railway — Miễn phí (khuyên dùng cho demo)

Railway cung cấp $5 credit/tháng, đủ cho khoảng 2–3 service nhỏ.

### A.1 Chuẩn bị

1. Tạo tài khoản tại **https://railway.app** (đăng nhập bằng GitHub)
2. Fork hoặc push repo lên GitHub

### A.2 Tạo project và PostgreSQL

```
1. Railway Dashboard → New Project → Deploy from GitHub repo
2. Chọn repo của bạn
3. Add → Database → PostgreSQL
4. Vào tab PostgreSQL → Variables → sao chép DATABASE_URL
```

### A.3 Deploy NestJS API (`apps/api`)

```
1. New Service → GitHub Repo → chọn repo
2. Settings → Root Directory: src/apps/api
3. Settings → Build Command: npm run build
4. Settings → Start Command: npm run start:prod
5. Variables → thêm tất cả env vars (xem bên dưới)
6. Deploy
```

### A.4 Deploy Next.js Web (`apps/web`)

```
1. New Service → GitHub Repo → chọn cùng repo
2. Settings → Root Directory: src/apps/web
3. Settings → Build Command: npm run build
4. Settings → Start Command: npm run start
5. Variables → thêm tất cả env vars
6. Deploy → lấy URL public (ví dụ: https://web-xxx.railway.app)
```

### A.5 Env vars cho Railway

**Service `apps/api`:**
```env
DATABASE_URL=<từ Railway PostgreSQL>
WEB_URL=<URL của service apps/web>
NODE_ENV=production
PORT=4000
ACCESSTRADE_ACCESS_KEY=
SHOPEE_AFFILIATE_APP_ID=
SHOPEE_AFFILIATE_APP_SECRET=
# ... các key tùy chọn khác
```

**Service `apps/web`:**
```env
DATABASE_URL=<từ Railway PostgreSQL — cùng DB với api>
NEXT_PUBLIC_SITE_URL=<URL public của service này>
WEB_URL=<URL của service này>
NODE_ENV=production
API_URL=<URL internal của service apps/api — Railway internal URL>
API_INTERNAL_SECRET=<random string ≥ 32 ký tự — phải khớp với apps/api>
# ... các key AI, Zalo, v.v.
```

### A.6 Khởi tạo DB Schema

Sau khi cả 2 service đã deploy, chạy schema.sql một lần:

```bash
# Cài psql local nếu chưa có, rồi:
psql "<DATABASE_URL từ Railway>" -f src/apps/web/prisma/schema.sql
```

Hoặc dùng Railway CLI:
```bash
npm install -g @railway/cli
railway login
railway run --service=<api-service-name> npx prisma db push
```

> Railway tự build lại khi push code lên GitHub — CI/CD tự động.

---

## B. Vercel (web) + Railway (api + db)

Phương án tốt nhất cho production nhỏ: Vercel tối ưu cho Next.js, Railway giữ NestJS luôn chạy.

### B.1 Deploy NestJS lên Railway

Làm giống **A.3** ở trên — chỉ cần 1 service NestJS + PostgreSQL.

### B.2 Deploy Next.js lên Vercel

```
1. vercel.com → Import Project → chọn GitHub repo
2. Framework Preset: Next.js (tự detect)
3. Root Directory: src/apps/web   ← QUAN TRỌNG
4. Environment Variables → thêm tất cả (xem bên dưới)
5. Deploy
```

### B.3 Env vars cho Vercel

```env
DATABASE_URL=<từ Railway PostgreSQL>
NEXT_PUBLIC_SITE_URL=https://your-project.vercel.app
WEB_URL=https://your-project.vercel.app
NODE_ENV=production
GOOGLE_AI_API_KEY=
OPENAI_API_KEY=
# ... các key khác
```

### B.4 Custom domain trên Vercel

```
Vercel Dashboard → Project Settings → Domains → Add Domain
→ Thêm CNAME record vào DNS provider (Cloudflare, Namecheap, v.v.)
```

### B.5 Cập nhật WEB_URL trong Railway sau khi có domain

Khi Vercel có domain thật, cập nhật env var `WEB_URL` trong Railway service api → Redeploy.

### B.6 Prisma generate

Vercel build tự chạy `prisma generate` nếu `package.json` có:
```json
"scripts": {
  "postinstall": "prisma generate"
}
```
Kiểm tra `src/apps/web/package.json` — nếu chưa có, thêm vào.

---

## C. Render (web + api) + Neon DB

Hoàn toàn miễn phí nhưng **có giới hạn**: Render free tier ngủ sau 15 phút không có request → **cron jobs sẽ không chạy đúng giờ**.

> **Không khuyên dùng cho production** — chỉ phù hợp test/dev. Nếu muốn dùng Render cho production, cần trả $7/tháng/service (Starter plan).

### C.1 Tạo PostgreSQL trên Neon

```
1. neon.tech → Sign Up (GitHub)
2. New Project → chọn region gần Việt Nam (Singapore)
3. Dashboard → Connection string → sao chép DATABASE_URL
```

### C.2 Deploy NestJS lên Render

```
1. render.com → New → Web Service
2. Connect GitHub repo
3. Root Directory: src/apps/api
4. Build Command: npm install && npm run build
5. Start Command: npm run start:prod
6. Instance Type: Free (hoặc Starter $7 cho production)
7. Environment Variables → thêm env vars
8. Deploy
```

### C.3 Deploy Next.js lên Render

```
1. New → Web Service
2. Root Directory: src/apps/web
3. Build Command: npm install && npm run build
4. Start Command: npm run start
5. Instance Type: Free hoặc Starter
6. Environment Variables → thêm env vars
7. Deploy
```

### C.4 Khởi tạo DB

```bash
psql "<Neon DATABASE_URL>" -f src/apps/web/prisma/schema.sql
```

---

## D. VPS tự quản lý — Khuyên dùng khi có traffic

Kiểm soát hoàn toàn, giá tốt nhất dài hạn, cron jobs chạy ổn định.

### D.1 Chọn VPS provider

| Provider | Giá thấp nhất | RAM | CPU | Ghi chú |
|---|---|---|---|---|
| **Hetzner** ⭐ | ~$4/tháng | 2GB | 2 vCPU | Rẻ nhất, server EU |
| **Vultr** | $6/tháng | 1GB | 1 vCPU | Nhiều region, có Singapore |
| **DigitalOcean** | $6/tháng | 1GB | 1 vCPU | UI đẹp, docs tốt |
| **Linode/Akamai** | $5/tháng | 1GB | 1 vCPU | Ổn định |
| **UpCloud** | $5/tháng | 1GB | 1 vCPU | Có Singapore |

> Khuyên dùng **Hetzner CX22** (€3.79/tháng, 2 vCPU, 4GB RAM) — đủ thoải mái chạy cả 2 app + PostgreSQL.

### D.2 Tạo server (Ubuntu 22.04)

```bash
# Chọn Ubuntu 22.04 LTS khi tạo VPS
# Thêm SSH key để đăng nhập an toàn
```

### D.3 Kết nối và cài đặt cơ bản

```bash
ssh root@<your-server-ip>

# Cập nhật hệ thống
apt update && apt upgrade -y

# Cài Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Cài PM2 (process manager)
npm install -g pm2

# Cài PostgreSQL
apt install -y postgresql postgresql-contrib

# Cài Nginx (reverse proxy)
apt install -y nginx

# Cài Certbot (SSL miễn phí)
apt install -y certbot python3-certbot-nginx

# Cài Git
apt install -y git
```

### D.4 Cấu hình PostgreSQL

```bash
# Tạo user và database
sudo -u postgres psql << 'EOF'
CREATE USER affiliate_user WITH PASSWORD 'strong_password_here';
CREATE DATABASE affiliate OWNER affiliate_user;
GRANT ALL PRIVILEGES ON DATABASE affiliate TO affiliate_user;
\q
EOF

# Test kết nối
psql "postgresql://affiliate_user:strong_password_here@localhost:5432/affiliate" -c "SELECT 1;"
```

### D.5 Clone và build project

```bash
# Tạo user riêng (không chạy app với root)
adduser deploy
usermod -aG sudo deploy
su - deploy

# Clone repo
git clone https://github.com/your-username/your-repo.git /home/deploy/app
cd /home/deploy/app

# Tạo .env
cp src/.env.example src/.env
nano src/.env   # Điền tất cả env vars

# Cài dependencies và build
cd src/apps/web
npm install
npm run build

cd ../api
npm install
npm run build
```

### D.6 Khởi tạo database schema

```bash
export DATABASE_URL="postgresql://affiliate_user:strong_password_here@localhost:5432/affiliate"
psql "$DATABASE_URL" -f /home/deploy/app/src/apps/web/prisma/schema.sql
```

### D.7 Cấu hình PM2

Tạo file ecosystem tại `/home/deploy/app/ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: "affiliate-web",
      cwd: "/home/deploy/app/src/apps/web",
      script: "node_modules/.bin/next",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        API_URL: "http://localhost:4000",       // web → api (cùng VPS)
        API_INTERNAL_SECRET: "your_secret_here", // phải khớp với api
      },
    },
    {
      name: "affiliate-api",
      cwd: "/home/deploy/app/src/apps/api",
      script: "dist/main.js",
      env: {
        NODE_ENV: "production",
        PORT: 4000,
        API_INTERNAL_SECRET: "your_secret_here", // bảo vệ /sync/* endpoints
      },
    },
  ],
}
```

```bash
# Khởi động cả 2 app
pm2 start /home/deploy/app/ecosystem.config.js

# Xem log
pm2 logs
pm2 logs affiliate-web
pm2 logs affiliate-api

# Auto-start khi server reboot
pm2 startup
pm2 save
```

### D.8 Cấu hình Nginx (reverse proxy)

```bash
nano /etc/nginx/sites-available/affiliate
```

```nginx
server {
    server_name yourdomain.com www.yourdomain.com;

    # Next.js web app
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    listen 80;
}
```

```bash
# Kích hoạt site
ln -s /etc/nginx/sites-available/affiliate /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### D.9 Cài SSL miễn phí (Let's Encrypt)

```bash
# Cần domain đã trỏ về IP server trước
certbot --nginx -d yourdomain.com -d www.yourdomain.com

# SSL auto-renew (tự động, Certbot tự cài cron)
certbot renew --dry-run
```

### D.10 Cập nhật code (deploy mới)

```bash
# Script deploy đơn giản: /home/deploy/deploy.sh
#!/bin/bash
set -e
cd /home/deploy/app

echo "==> Pulling latest code..."
git pull origin main

echo "==> Building web..."
cd src/apps/web
npm install --production=false
npm run build

echo "==> Building api..."
cd ../api
npm install --production=false
npm run build

echo "==> Restarting services..."
pm2 restart all

echo "==> Done!"
```

```bash
chmod +x /home/deploy/deploy.sh
# Để deploy: ./deploy.sh
```

### D.11 Firewall cơ bản

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
# Port 3000 và 4000 KHÔNG mở ra ngoài — chỉ Nginx mới truy cập
```

---

## E. Docker Compose trên VPS

Nếu muốn môi trường nhất quán, dễ migrate giữa các server.

### E.1 Cài Docker

```bash
curl -fsSL https://get.docker.com | bash
systemctl enable docker
```

### E.2 Tạo `docker-compose.yml`

Tạo tại root repo:

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: affiliate_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: affiliate
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./src/apps/web/prisma/schema.sql:/docker-entrypoint-initdb.d/schema.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U affiliate_user"]
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    build:
      context: ./src/apps/api
      dockerfile: Dockerfile
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://affiliate_user:${POSTGRES_PASSWORD}@postgres:5432/affiliate
      WEB_URL: ${NEXT_PUBLIC_SITE_URL}
      NODE_ENV: production
      PORT: 4000
    env_file: ./src/.env
    ports:
      - "4000:4000"

  web:
    build:
      context: ./src/apps/web
      dockerfile: Dockerfile
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      api:
        condition: service_started
    environment:
      DATABASE_URL: postgresql://affiliate_user:${POSTGRES_PASSWORD}@postgres:5432/affiliate
      NODE_ENV: production
      PORT: 3000
      API_URL: http://api:4000          # web → api qua Docker network
    env_file: ./src/.env
    ports:
      - "3000:3000"

volumes:
  pgdata:
```

### E.3 Dockerfile cho NestJS (`src/apps/api/Dockerfile`)

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
EXPOSE 4000
CMD ["node", "dist/main.js"]
```

### E.4 Dockerfile cho Next.js (`src/apps/web/Dockerfile`)

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
RUN npx prisma generate
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

> Cần thêm vào `next.config.js`: `output: 'standalone'` để Docker build tối ưu.

### E.5 Chạy với Docker Compose

```bash
# Điền POSTGRES_PASSWORD vào src/.env
echo "POSTGRES_PASSWORD=your_strong_password" >> src/.env

# Build và chạy
docker compose up -d --build

# Xem log
docker compose logs -f

# Cập nhật code
git pull
docker compose up -d --build
```

---

## So sánh nhanh

| | Railway | Vercel+Railway | VPS (PM2) | Docker |
|---|---|---|---|---|
| **Chi phí** | Free→$5/tháng | ~$5/tháng | $4–15/tháng | $4–15/tháng |
| **Setup** | 15 phút | 30 phút | 1–2 giờ | 2–3 giờ |
| **Cron jobs** | ✅ Ổn định | ✅ Ổn định | ✅ Ổn định | ✅ Ổn định |
| **Scale** | Tự động | Tự động | Thủ công | Thủ công |
| **Custom domain** | ✅ | ✅ | ✅ | ✅ |
| **SSL** | ✅ Tự động | ✅ Tự động | ✅ Certbot | ✅ Certbot |
| **DB backup** | Tự động | Tự động | Tự làm | Tự làm |
| **Phù hợp** | Demo, MVP | Production nhỏ | Production | Production có DevOps |

---

## Tips quan trọng

### Database backup (VPS)

```bash
# Backup tự động mỗi ngày lúc 2h sáng
crontab -e
# Thêm dòng:
0 2 * * * pg_dump -U affiliate_user affiliate | gzip > /home/deploy/backups/db_$(date +\%Y\%m\%d).sql.gz

# Giữ 7 ngày gần nhất
0 3 * * * find /home/deploy/backups -name "*.sql.gz" -mtime +7 -delete
```

### Monitoring đơn giản

```bash
# PM2 monitoring
pm2 monit

# Uptime check miễn phí: uptimerobot.com
# → Tạo HTTP monitor cho https://yourdomain.com/api/health
# → Báo qua email/Telegram khi down
```

### Lần đầu sau khi deploy

```bash
# 1. Kiểm tra health
curl https://yourdomain.com/api/health

# 2. Chạy sync thủ công (không cần chờ cron)
# Vào https://yourdomain.com/admin/jobs → chọn "Đồng bộ sản phẩm" → Chạy ngay
# (hoặc "Đồng bộ Coupon/Voucher" để sync coupon ngay)

# 3. Vào admin
# https://yourdomain.com/admin → đăng nhập → kiểm tra

# 4. Khởi tạo DB với schema.sql (nếu chưa làm)
psql "$DATABASE_URL" -f src/apps/web/prisma/schema.sql
```

### Biến env cần đặt trên production

Tối thiểu để hệ thống chạy có data:
```env
DATABASE_URL=
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
WEB_URL=https://yourdomain.com
NODE_ENV=production
ACCESSTRADE_ACCESS_KEY=   # Hoặc Shopee
API_URL=http://localhost:4000         # VPS: localhost; Docker: http://api:4000
API_INTERNAL_SECRET=                  # Random string ≥ 32 ký tự — bảo vệ /sync/* endpoints
```

Thêm để có AI:
```env
GOOGLE_AI_API_KEY=        # Miễn phí — khuyên dùng trước
```

Thêm để có embedding matching:
```env
OPENAI_API_KEY=
```
