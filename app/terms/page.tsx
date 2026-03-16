import Link from "next/link"

export const metadata = {
  title: "Terms of Service | Relay",
  description: "Relay terms of service – rules for using the application.",
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[var(--relay-bg)] py-12 px-4">
      <div className="mx-auto max-w-[720px] rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-[var(--relay-primary-dark)]">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-[var(--relay-muted-steel)]">
          Last updated: March 2025
        </p>

        <section className="mt-8 space-y-6 text-[var(--relay-deep-slate)]">
          <div>
            <h2 className="text-lg font-medium text-[var(--relay-primary-dark)]">
              Acceptance
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed">
              By signing in or using Relay, you agree to these terms. Relay is an AI
              chief-of-staff application that connects to your Google account and optional
              meeting providers to provide briefings, drafts, and action suggestions.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-medium text-[var(--relay-primary-dark)]">
              Use of the service
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed">
              You must use Relay in compliance with applicable laws and the terms of any
              third-party services you connect (e.g. Google, meeting providers). You are
              responsible for keeping your credentials secure and for how you use AI-generated
              content (e.g. email drafts). Do not use Relay for illegal or abusive purposes.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-medium text-[var(--relay-primary-dark)]">
              Disclaimer
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed">
              Relay is provided &ldquo;as is.&rdquo; AI outputs may be inaccurate or inappropriate; always
              review before sending or acting. We do not guarantee availability, accuracy, or
              fitness for a particular purpose. We are not liable for decisions you make based
              on Relay&apos;s suggestions.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-medium text-[var(--relay-primary-dark)]">
              Changes
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed">
              We may update these terms from time to time. Continued use of Relay after
              changes constitutes acceptance. The &ldquo;Last updated&rdquo; date at the top reflects the
              latest revision.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-medium text-[var(--relay-primary-dark)]">
              Contact
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed">
              For questions about these terms, contact the Relay team through the application
              or project repository.
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
