export interface StoreSettings {
  storeName: string
  storeUrl: string
  bio: string
  bankName: string
  accountNumber: string
  accountHolder: string
  minPayout: number
  primaryColor: string
  autoPayout: boolean
  twoFA: boolean
  logo: string
}

const defaults: StoreSettings = {
  storeName: "Shopby Affiliate Store",
  storeUrl: "shopby.io",
  bio: "Kurator produk affiliate Shopee pilihan — rekomendasi terbaik, harga transparan.",
  bankName: "BCA",
  accountNumber: "1234-5678-9012",
  accountHolder: "JOHN DOE",
  minPayout: 100000,
  primaryColor: "red",
  autoPayout: true,
  twoFA: false,
  logo: "",
}

export async function fetchSettings(): Promise<StoreSettings> {
  try {
    const token = typeof document !== "undefined" ? document.cookie.match(/(?:^|;\s*)shopby_csrf=([^;]*)/)?.[1] || "" : ""
    const res = await fetch("/api/settings", {
      headers: { "x-csrf-token": token },
    })
    if (!res.ok) throw new Error("Failed to fetch settings")
    const data = await res.json()
    return { ...defaults, ...data }
  } catch {
    return { ...defaults }
  }
}
