import { CheckCircle2, XCircle, Mail, Calendar } from "lucide-react"
import { listActionExecutions } from "@/lib/persistence/action-executions"

export const dynamic = "force-dynamic"

export default async function HistoryPage() {
  const executions = await listActionExecutions()

  return (
    <div className="space-y-6">
      <div className="animate-relay-fade-in">
        <h1 className="text-2xl font-semibold tracking-tight text-[#1B2E3B]">
          Action history
        </h1>
        <p className="mt-0.5 text-sm text-[#3F5363]">
          Approved actions and their execution status. Live entries used your connected Google account.
        </p>
      </div>

      {executions.length === 0 ? (
        <div className="animate-relay-fade-in rounded-relay-card border border-[var(--border)] bg-white/80 p-8 text-center shadow-relay-soft">
          <p className="text-[#3F5363]">No action executions yet.</p>
          <p className="mt-1 text-sm text-[#314555]">
            Approve an action on the Actions page to see it here.
          </p>
        </div>
      ) : (
        <ul className="space-y-3 animate-relay-fade-in opacity-0 [animation-delay:75ms] [animation-fill-mode:forwards]">
          {executions.map((ex) => (
            <li
              key={ex.id}
              className="rounded-relay-card border border-[var(--border)] bg-white/80 p-4 shadow-relay-soft"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-relay-control bg-[#e8edf3] text-[#314555]">
                    {ex.type === "draft_email" ? (
                      <Mail className="h-4 w-4" />
                    ) : (
                      <Calendar className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-[#1B2E3B]">{ex.title}</p>
                    <p className="text-sm text-[#3F5363]">
                      {new Date(ex.executedAt).toLocaleString("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                    <span
                      className={`mt-1 inline-block rounded-relay-control px-2 py-0.5 text-[11px] font-medium ${
                        ex.source === "live"
                          ? "bg-[#213443]/10 text-[#213443]"
                          : "bg-[#e8edf3] text-[#314555]"
                      }`}
                    >
                      {ex.source === "live" ? "Live" : "Mock"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {ex.status === "success" ? (
                    <span className="flex items-center gap-1 text-sm text-[#1B2E3B]">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      Success
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-sm text-red-600">
                      <XCircle className="h-4 w-4" />
                      Failed
                    </span>
                  )}
                </div>
              </div>
              {ex.status === "failed" && ex.errorMessage && (
                <p className="mt-2 text-sm text-red-600 rounded-relay-inner border border-red-200 bg-red-50/50 px-3 py-2">
                  {ex.errorMessage}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
