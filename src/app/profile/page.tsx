import Link from "next/link";

export default function ProfilePage() {
  return (
    <main className="profile-arrival">
      <div className="profile-arrival__glow" aria-hidden="true" />
      <section>
        <p>MEDICAL SCHOOL TRAJECTORY</p>
        <h1>Let&apos;s map where you are now.</h1>
        <span>Your background profile begins here.</span>
        <Link href="/">← Back to destinations</Link>
      </section>
    </main>
  );
}
