import { notFound } from "next/navigation"
import type { Metadata } from "next"
import ContentPageShell from "@/components/layout/ContentPageShell"
import { getStaticPageDb } from "@/lib/static-pages-db"

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const page = await getStaticPageDb(slug)
  if (!page?.published) return {}
  return {
    title: page.title,
    description: page.description || undefined,
  }
}

export default async function DynamicStaticPage({ params }: Props) {
  const { slug } = await params
  const page = await getStaticPageDb(slug)

  if (!page || !page.published) notFound()

  return (
    <ContentPageShell
      title={page.title}
      breadcrumb={[{ label: "Trang chủ", href: "/" }, { label: page.title }]}
      currentSlug={slug}
    >
      <div className="prose-blog" dangerouslySetInnerHTML={{ __html: page.content }} />
    </ContentPageShell>
  )
}
