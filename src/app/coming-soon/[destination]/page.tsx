import Link from "next/link";
import { notFound } from "next/navigation";

const destinationNames = {
  law: "Law School",
  dental: "Dental School",
};

export default async function ComingSoonPage({
  params,
}: {
  params: Promise<{ destination: string }>;
}) {
  const { destination } = await params;
  const destinationName = destinationNames[destination as keyof typeof destinationNames];
  if (!destinationName) notFound();

  return (
    <main className="coming-soon-page">
      <div className="coming-soon-page__orbit" aria-hidden="true"><i /><span /></div>
      <section>
        <p>{destinationName.toUpperCase()} TRAJECTORY</p>
        <h1>Coming Soon!</h1>
        <span>We&apos;re still mapping this destination. The Medical School pathway is ready to explore now.</span>
        <Link href="/">← Back to destinations</Link>
      </section>
    </main>
  );
}
