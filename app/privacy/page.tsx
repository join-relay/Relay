import Link from "next/link"

export const metadata = {
  title: "Privacy Policy | Relay",
  description: "Relay privacy policy – how we collect, use, and protect your data.",
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[var(--relay-bg)] py-12 px-4">
      <div className="mx-auto max-w-[720px] rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-[var(--relay-primary-dark)]">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-[var(--relay-muted-steel)]">
          Last updated: March 2025
        </p>

        <section className="mt-8 space-y-6 text-[var(--relay-deep-slate)]">
          <div>
            <h2 className="text-lg font-medium text-[var(--relay-primary-dark)]">
              Overview
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed">
              Relay is an AI chief-of-staff that helps you manage overload by connecting to your
              Google account (Gmail, Calendar, Drive) and optional meeting providers. This policy
              describes how we handle your information when you use Relay.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-medium text-[var(--relay-primary-dark)]">
              Data we use
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed">
              We access only the Google data you authorize (email, calendar, Drive files) and use
              it to provide briefing, draft replies, and action suggestions. We do not sell your
              data. Data may be processed by third-party services (e.g. AI providers, hosting) in
              accordance with their privacy practices and our agreements with them.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-medium text-[var(--relay-primary-dark)]">
              Storage and security
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed">
              OAuth tokens and app state are stored securely. On hosted deployments we use
              environment-backed storage (e.g. Vercel KV). We take reasonable steps to protect
              your data from unauthorized access or disclosure.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-medium text-[var(--relay-primary-dark)]">
              Your choices
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed">
              You can revoke Relay&apos;s access at any time via your Google account settings or by
              disconnecting within Relay. Deleting your account or revoking access will stop
              further use of your data; existing backups may be retained as required by law or
              operational need.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-medium text-[var(--relay-primary-dark)]">
              Contact
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed">
              For questions about this privacy policy or your data, contact the Relay team through
              the channels provided in the application or on the project repository.
            </p>
          </div>
        </section>

        <p className="mt-10 text-sm text-[var(--relay-muted-steel)]">
          <Link href="/" className="underline hover:text-[var(--relay-primary-dark)]">
            ← Back to Relay
          </Link>
        </p>
      </div>
    </main>
  )
}
