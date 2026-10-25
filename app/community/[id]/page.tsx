import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CommunityGame } from "@/components/studio/CommunityGame";
import { getSession } from "@/lib/session";
import { StudioError, viewGame } from "@/lib/studio/server";

async function load(id: string) {
  try {
    return await viewGame(id, await getSession());
  } catch (e) {
    if (e instanceof StudioError && e.status === 404) return null;
    throw e;
  }
}

export async function generateMetadata({ params }: PageProps<"/community/[id]">): Promise<Metadata> {
  const view = await load((await params).id);
  return view ? { title: view.meta.title, description: view.meta.description || `A community game by ${view.meta.owner_name}.` } : {};
}

export default async function CommunityGamePage({ params }: PageProps<"/community/[id]">) {
  const view = await load((await params).id);
  if (!view) notFound();
  return <CommunityGame view={view} />;
}
