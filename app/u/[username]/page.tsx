import type { Metadata } from "next";
import { PublicProfile } from "@/components/site/People";

export async function generateMetadata({ params }: PageProps<"/u/[username]">): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${decodeURIComponent(username)} 👤` };
}

export default async function UserPage({ params }: PageProps<"/u/[username]">) {
  const { username } = await params;
  return <PublicProfile username={decodeURIComponent(username)} />;
}
