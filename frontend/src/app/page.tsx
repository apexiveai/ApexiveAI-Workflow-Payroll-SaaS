
"use client";

import {
  Activity,
  ArrowRight,
  Building2,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Command,
  CreditCard,
  Eye,
  EyeOff,
  Fingerprint,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
).replace(/\/+$/, "");

const PAGE_SIZE = 10;
const TOKEN_KEY = "apexive_token";
const USER_KEY = "apexive_user";

type User = {
  id: string | number;
  company_id: string | number | null;
  username: string;
  email?: string | null;
  role: string;
  is_active: boolean;
};

type LoginResponse = {
  access_token: string;
  token_type?: string;
  user: User;
};

type Company = {
  id: string | number;
  name: string;
  code: string;
  is_active: boolean;
  created_at?: string | null;
};

type CompanyPayload = {
  name: string;
  code: string;
  is_active: boolean;
};

type ApiError = Error & {
  status?: number;
};

type ApiResponse<T> = {
  items: T[];
  total: number;
};

const NAVIGATION = [
  {
    group: "WORKSPACE",
    items: [
      { label: "Overview", icon: LayoutDashboard },
      { label: "Companies", icon: Building2 },
    ],
  },
  {
    group: "WORKFORCE",
    items: [
      { label: "Employees", icon: Users },
      { label: "Attendance", icon: CalendarCheck },
      { label: "Payroll", icon: Wallet },
    ],
  },
  {
    group: "MANAGEMENT",
    items: [{ label: "Subscriptions", icon: CreditCard }],
  },
];

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "An unexpected error occurred.";
}

async function apiRequest<T>(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
      cache: "no-store",
      signal: init.signal ?? AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error(
      `Cannot connect to the API at ${API_URL}. Check that the backend is running.`,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let data: unknown;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const body = data as { detail?: unknown; message?: string } | null;
    let message = body?.message || `Request failed (${response.status}).`;

    if (typeof body?.detail === "string") {
      message = body.detail;
    } else if (Array.isArray(body?.detail)) {
      message = body.detail
        .map((item) => {
          const entry = item as { msg?: string };
          return entry.msg || "Invalid input";
        })
        .join(", ");
    }

    const error = new Error(
      response.status === 401
        ? "Your session has expired. Please sign in again."
        : response.status === 403
          ? "You do not have permission to perform this action."
          : message,
    ) as ApiError;

    error.status = response.status;
    throw error;
  }

  return data as T;
}

function normalizeCompanies(
  data: unknown,
  page: number,
): ApiResponse<Company> {
  if (Array.isArray(data)) {
    return { items: data as Company[], total: data.length };
  }

  if (!data || typeof data !== "object") {
    throw new Error("Unexpected companies API response.");
  }

  const body = data as Record<string, unknown>;
  const rawItems =
    body.items ?? body.results ?? body.companies ?? body.data ?? [];

  if (!Array.isArray(rawItems)) {
    throw new Error("Companies API did not return a list.");
  }

  const items = rawItems as Company[];
  const rawTotal = body.total ?? body.count ?? body.total_count;

  return {
    items,
    total:
      typeof rawTotal === "number"
        ? rawTotal
        : (page - 1) * PAGE_SIZE + items.length,
  };
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="brand-mark flex h-10 w-10 items-center justify-center rounded-xl">
        <Command size={21} />
      </div>
      <div>
        <div className="text-sm font-semibold tracking-[0.12em] text-white">
          APEXIVE<span className="text-zinc-500">AI</span>
        </div>
        <div className="mt-0.5 text-[9px] tracking-[0.2em] text-zinc-500">
          WORKFORCE PLATFORM
        </div>
      </div>
    </div>
  );
}

function Button({
  children,
  onClick,
  disabled,
  secondary = false,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  secondary?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${secondary ? "secondary-button" : "primary-button"} disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {children}
    </button>
  );
}

function ErrorBanner({
  message,
  onClose,
}: {
  message: string;
  onClose?: () => void;
}) {
  return (
    <div
      role="alert"
      className="mb-5 flex items-start gap-3 rounded-xl border border-red-400/20 bg-red-400/[0.06] p-4 text-sm text-red-200"
    >
      <CircleAlert size={18} className="mt-0.5 shrink-0" />
      <span className="min-w-0 flex-1">{message}</span>
      {onClose && (
        <button
          onClick={onClose}
          aria-label="Dismiss error"
          className="text-red-200/70 hover:text-white"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}

function LoginScreen({
  onLogin,
}: {
  onLogin: (username: string, password: string) => Promise<void>;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      await onLogin(username.trim(), password);
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-12">
      <div className="login-orb -left-32 -top-24" />
      <div className="login-orb -bottom-40 -right-28" />

      <div className="relative z-10 w-full max-w-[420px]">
        <div className="mb-10 flex justify-center">
          <Brand />
        </div>

        <section className="panel p-6 sm:p-9">
          <div className="mb-8">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.045]">
              <ShieldCheck size={22} />
            </div>
            <p className="mb-2 text-[11px] tracking-[0.19em] text-zinc-500">
              SECURE WORKSPACE
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Welcome back.
            </h1>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Sign in to your ApexiveAI workforce account.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-5">
            <div>
              <label
                htmlFor="username"
                className="mb-2 block text-xs text-zinc-300"
              >
                Username
              </label>
              <input
                id="username"
                className="field"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Enter your username"
                required
                maxLength={100}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-xs text-zinc-300"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  className="field pr-12"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  required
                  maxLength={128}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {error && <ErrorBanner message={error} />}

            <button
              type="submit"
              disabled={busy}
              className="primary-button w-full py-3 text-sm"
            >
              {busy ? (
                <>
                  <LoaderCircle size={17} className="animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in securely <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-white/[0.07] pt-5 text-[11px] leading-5 text-zinc-500">
            Authorized accounts only. Contact your system administrator if you
            need access.
          </div>
        </section>

        <p className="mt-6 text-center text-[10px] tracking-[0.15em] text-zinc-600">
          APEXIVEAI · WORKFORCE MANAGEMENT
        </p>
      </div>
    </main>
  );
}

function MetricCard({
  label,
  description,
  icon: Icon,
}: {
  label: string;
  description: string;
  icon: typeof Building2;
}) {
  return (
    <div className="panel metric-card min-w-0 p-5">
      <div className="mb-6 flex items-center justify-between gap-3">
        <span className="text-xs text-zinc-400">{label}</span>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.035]">
          <Icon size={17} className="text-zinc-300" />
        </div>
      </div>
      <div className="text-3xl font-semibold tracking-tight text-white">—</div>
      <p className="mt-2 text-[11px] leading-5 text-zinc-500">{description}</p>
    </div>
  );
}

function CompanyManagement({
  token,
  onUnauthorized,
}: {
  token: string;
  onUnauthorized: () => void;
}) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [active, setActive] = useState(true);

  const loadCompanies = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      /*
       * This is the proposed list contract.
       * Confirm the actual backend route and query parameters before production.
       */
      const query = new URLSearchParams({
        page: String(page),
        page_size: String(PAGE_SIZE),
      });

      const response = await apiRequest<unknown>(
        `/api/companies?${query.toString()}`,
        token,
      );

      const normalized = normalizeCompanies(response, page);
      setCompanies(normalized.items);
      setTotal(normalized.total);
    } catch (reason) {
      const err = reason as ApiError;
      setError(getErrorMessage(err));

      if (err.status === 401) {
        onUnauthorized();
      }
    } finally {
      setLoading(false);
    }
  }, [page, token, onUnauthorized]);

  useEffect(() => {
    void loadCompanies();
  }, [loadCompanies]);

  const filteredCompanies = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return companies;

    return companies.filter(
      (company) =>
        company.name.toLowerCase().includes(query) ||
        company.code.toLowerCase().includes(query),
    );
  }, [companies, search]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function openCreate() {
    setEditing(null);
    setName("");
    setCode("");
    setActive(true);
    setError("");
    setNotice("");
    setDialogOpen(true);
  }

  function openEdit(company: Company) {
    setEditing(company);
    setName(company.name);
    setCode(company.code);
    setActive(company.is_active);
    setError("");
    setNotice("");
    setDialogOpen(true);
  }

  async function saveCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    const payload: CompanyPayload = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      is_active: active,
    };

    try {
      /*
       * Proposed API contract:
       * POST   /api/companies
       * PATCH  /api/companies/{id}
       *
       * If your backend uses PUT or different schema fields, adjust here.
       */
      if (editing) {
        await apiRequest<Company>(
          `/api/companies/${encodeURIComponent(String(editing.id))}`,
          token,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          },
        );
      } else {
        await apiRequest<Company>("/api/companies", token, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      setDialogOpen(false);
      setNotice(editing ? "Company updated." : "Company created.");
      await loadCompanies();
    } catch (reason) {
      const err = reason as ApiError;
      setError(getErrorMessage(err));

      if (err.status === 401) {
        onUnauthorized();
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggleCompany(company: Company) {
    setError("");
    setNotice("");

    try {
      await apiRequest<Company>(
        `/api/companies/${encodeURIComponent(String(company.id))}`,
        token,
        {
          method: "PATCH",
          body: JSON.stringify({
            is_active: !company.is_active,
          }),
        },
      );

      setNotice(
        `${company.name} ${company.is_active ? "deactivated" : "activated"}.`,
      );
      await loadCompanies();
    } catch (reason) {
      const err = reason as ApiError;
      setError(getErrorMessage(err));

      if (err.status === 401) {
        onUnauthorized();
      }
    }
  }

  return (
    <>
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-[11px] tracking-[0.17em] text-zinc-500">
            TENANT ADMINISTRATION
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-[30px]">
            Companies
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Create and manage tenant companies on the platform.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} /> Add company
        </Button>
      </div>

      {error && (
        <ErrorBanner message={error} onClose={() => setError("")} />
      )}

      {notice && (
        <div
          role="status"
          className="mb-5 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-zinc-200"
        >
          {notice}
        </div>
      )}

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="panel p-5">
          <p className="text-xs text-zinc-500">Companies in current result</p>
          <p className="mt-3 text-2xl font-semibold text-white">
            {loading ? "—" : total.toLocaleString()}
          </p>
        </div>
        <div className="panel p-5">
          <p className="text-xs text-zinc-500">Active on this page</p>
          <p className="mt-3 text-2xl font-semibold text-white">
            {loading
              ? "—"
              : companies.filter((company) => company.is_active).length}
          </p>
        </div>
        <div className="panel p-5">
          <p className="text-xs text-zinc-500">Inactive on this page</p>
          <p className="mt-3 text-2xl font-semibold text-white">
            {loading
              ? "—"
              : companies.filter((company) => !company.is_active).length}
          </p>
        </div>
      </div>

      <section className="panel overflow-hidden">
        <div className="flex flex-col justify-between gap-4 border-b border-white/[0.07] p-4 sm:flex-row sm:items-center sm:p-5">
          <div>
            <h2 className="text-sm font-semibold text-white">
              Company directory
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Company information returned by the API.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
              />
              <input
                className="field py-2.5 pl-9 text-xs"
                placeholder="Search this page..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Search companies on this page"
              />
            </div>
            <Button secondary onClick={() => void loadCompanies()} disabled={loading}>
              <RefreshCw
                size={14}
                className={loading ? "animate-spin" : ""}
              />
            </Button>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Company code</th>
                <th>Status</th>
                <th>Created</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5}>
                    <div className="flex items-center justify-center gap-2 py-12 text-zinc-400">
                      <LoaderCircle size={17} className="animate-spin" />
                      Loading companies...
                    </div>
                  </td>
                </tr>
              ) : filteredCompanies.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="py-12 text-center">
                      <Building2
                        size={25}
                        className="mx-auto mb-3 text-zinc-600"
                      />
                      <p className="text-sm text-zinc-300">
                        {search
                          ? "No matching companies on this page."
                          : "No company records returned."}
                      </p>
                      <p className="mt-2 text-xs text-zinc-500">
                        Check the backend API route and database records.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCompanies.map((company) => (
                  <tr key={String(company.id)}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.035]">
                          <Building2 size={16} className="text-zinc-300" />
                        </div>
                        <div>
                          <p className="font-medium text-zinc-100">
                            {company.name}
                          </p>
                          <p className="mt-1 text-[10px] text-zinc-600">
                            ID: {company.id}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="rounded-md border border-white/[0.08] bg-white/[0.025] px-2 py-1 font-mono text-[11px]">
                        {company.code}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`inline-flex items-center gap-2 text-xs ${
                          company.is_active
                            ? "text-emerald-300"
                            : "text-zinc-500"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            company.is_active
                              ? "bg-emerald-300"
                              : "bg-zinc-600"
                          }`}
                        />
                        {company.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="text-zinc-500">
                      {company.created_at
                        ? new Date(company.created_at).toLocaleDateString()
                        : "—"}
                    </td>
                    <td>
                      <div className="flex justify-end gap-2">
                        <button
                          className="secondary-button px-3 py-2 text-[11px]"
                          onClick={() => openEdit(company)}
                        >
                          Edit
                        </button>
                        <button
                          className="secondary-button px-3 py-2 text-[11px]"
                          onClick={() => void toggleCompany(company)}
                        >
                          {company.is_active ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col justify-between gap-3 border-t border-white/[0.07] px-4 py-4 sm:flex-row sm:items-center sm:px-5">
          <p className="text-xs text-zinc-500">
            Page {page} of {totalPages} · {total.toLocaleString()} companies
          </p>
          <div className="flex items-center gap-2">
            <Button
              secondary
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeft size={15} /> Previous
            </Button>
            <Button
              secondary
              disabled={page >= totalPages || loading}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
            >
              Next <ChevronRight size={15} />
            </Button>
          </div>
        </div>
      </section>

      {dialogOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              setDialogOpen(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="company-dialog-title"
            className="panel my-auto w-full max-w-lg p-6 sm:p-7"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="mb-2 text-[10px] tracking-[0.16em] text-zinc-500">
                  TENANT MANAGEMENT
                </p>
                <h2
                  id="company-dialog-title"
                  className="text-xl font-semibold text-white"
                >
                  {editing ? "Edit company" : "Create company"}
                </h2>
                <p className="mt-2 text-xs leading-5 text-zinc-500">
                  Changes are submitted to the backend API.
                </p>
              </div>
              <button
                aria-label="Close dialog"
                disabled={saving}
                onClick={() => setDialogOpen(false)}
                className="rounded-lg p-2 text-zinc-500 hover:bg-white/[0.05] hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={saveCompany} className="space-y-5">
              <div>
                <label
                  htmlFor="company-name"
                  className="mb-2 block text-xs text-zinc-300"
                >
                  Company name
                </label>
                <input
                  id="company-name"
                  className="field"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Example Company Ltd."
                  required
                  minLength={2}
                  maxLength={150}
                />
              </div>

              <div>
                <label
                  htmlFor="company-code"
                  className="mb-2 block text-xs text-zinc-300"
                >
                  Company code
                </label>
                <input
                  id="company-code"
                  className="field font-mono uppercase"
                  value={code}
                  onChange={(event) =>
                    setCode(
                      event.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9_-]/g, ""),
                    )
                  }
                  placeholder="EXAMPLE"
                  required
                  minLength={2}
                  maxLength={30}
                  pattern="[A-Z0-9_-]+"
                  title="Use uppercase letters, numbers, hyphens, or underscores."
                />
                <p className="mt-2 text-[10px] leading-5 text-zinc-500">
                  Must be unique. Backend validation remains authoritative.
                </p>
              </div>

              <label className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                <span>
                  <span className="block text-sm text-zinc-200">
                    Active company
                  </span>
                  <span className="mt-1 block text-[11px] text-zinc-500">
                    Enable or disable this tenant.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(event) => setActive(event.target.checked)}
                  className="h-4 w-4 accent-white"
                />
              </label>

              {error && <ErrorBanner message={error} />}

              <div className="flex flex-col-reverse gap-2 border-t border-white/[0.07] pt-5 sm:flex-row sm:justify-end">
                <Button
                  secondary
                  disabled={saving}
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <>
                      <LoaderCircle size={15} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      {editing ? "Save changes" : "Create company"}
                      <ArrowRight size={15} />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

function Overview({
  user,
  token,
  onUnauthorized,
  onOpenCompanies,
}: {
  user: User;
  token: string;
  onUnauthorized: () => void;
  onOpenCompanies: () => void;
}) {
  const [apiStatus, setApiStatus] = useState<
    "checking" | "connected" | "offline"
  >("checking");
  const [lastChecked, setLastChecked] = useState("");

  const checkAPI = useCallback(async () => {
    setApiStatus("checking");

    try {
      await apiRequest<unknown>("/health", "");
      setApiStatus("connected");
      setLastChecked(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    } catch {
      setApiStatus("offline");
    }
  }, []);

  useEffect(() => {
    void checkAPI();
  }, [checkAPI]);

  const role = user.role.replaceAll("_", " ");

  return (
    <>
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-[11px] tracking-[0.17em] text-zinc-500">
            YOUR WORKSPACE
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-[30px]">
            Overview
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            A clear view of your workforce operations.
          </p>
        </div>
        <Button secondary onClick={() => void checkAPI()} disabled={apiStatus === "checking"}>
          <RefreshCw
            size={14}
            className={apiStatus === "checking" ? "animate-spin" : ""}
          />
          Refresh connection
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Total companies",
            icon: Building2,
            description: "Tenant companies",
          },
          {
            label: "Total workforce",
            icon: Users,
            description: "Employee accounts",
          },
          {
            label: "Attendance today",
            icon: CalendarCheck,
            description: "Today's attendance",
          },
          {
            label: "Payroll this month",
            icon: Wallet,
            description: "Monthly payroll total",
          },
        ].map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="panel p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">
                Platform status
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                Backend health and connectivity
              </p>
            </div>
            <Activity size={18} className="text-zinc-500" />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div>
                <p className="text-sm text-zinc-200">Backend API</p>
                <p className="mt-1 break-all text-[11px] text-zinc-500">
                  {API_URL}
                </p>
              </div>
              <span
                className={`text-xs ${
                  apiStatus === "connected"
                    ? "text-emerald-300"
                    : apiStatus === "offline"
                      ? "text-red-300"
                      : "text-zinc-400"
                }`}
              >
                {apiStatus === "connected"
                  ? "Connected"
                  : apiStatus === "offline"
                    ? "Offline"
                    : "Checking"}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div>
                <p className="text-sm text-zinc-200">Current session</p>
                <p className="mt-1 text-[11px] text-zinc-500">
                  Signed in as {user.username}
                </p>
              </div>
              <span className="text-xs text-emerald-300">Authenticated</span>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div>
                <p className="text-sm text-zinc-200">Last health check</p>
                <p className="mt-1 text-[11px] text-zinc-500">
                  {lastChecked || "Waiting for first check"}
                </p>
              </div>
              <span className="text-xs text-zinc-400">
                {apiStatus === "connected" ? "Healthy" : "—"}
              </span>
            </div>
          </div>
        </section>

        <section className="panel p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
              <Fingerprint size={20} className="text-zinc-200" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                Account details
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                Authenticated user
              </p>
            </div>
          </div>

          <div className="space-y-4 border-t border-white/[0.07] pt-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-zinc-500">Username</span>
              <span className="max-w-[60%] truncate text-xs text-zinc-200">
                {user.username}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-zinc-500">Email</span>
              <span className="max-w-[60%] truncate text-xs text-zinc-200">
                {user.email || "—"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-zinc-500">Role</span>
              <span className="text-right text-xs text-zinc-200">{role}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-zinc-500">Status</span>
              <span className="text-xs text-emerald-300">
                {user.is_active ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
        </section>
      </div>

      <section className="panel mt-4 p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-white">Quick access</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Open company administration to load tenant records from the API.
        </p>
        <button
          onClick={onOpenCompanies}
          className="mt-5 flex w-full items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 text-left transition hover:bg-white/[0.05] sm:max-w-md"
        >
          <span className="flex items-center gap-3">
            <Building2 size={18} className="text-zinc-300" />
            <span>
              <span className="block text-sm text-zinc-200">
                Company management
              </span>
              <span className="mt-1 block text-[11px] text-zinc-500">
                View, create and update companies
              </span>
            </span>
          </span>
          <ArrowRight size={16} className="text-zinc-500" />
        </button>
      </section>
    </>
  );
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState("");
  const [restoring, setRestoring] = useState(true);
  const [activePage, setActivePage] = useState("Overview");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sessionError, setSessionError] = useState("");

  useEffect(() => {
    try {
      const storedToken = sessionStorage.getItem(TOKEN_KEY);
      const storedUser = sessionStorage.getItem(USER_KEY);

      if (storedToken && storedUser) {
        const parsed = JSON.parse(storedUser) as User;

        if (
          parsed &&
          (typeof parsed.id === "string" || typeof parsed.id === "number") &&
          typeof parsed.username === "string" &&
          typeof parsed.role === "string" &&
          typeof parsed.is_active === "boolean"
        ) {
          if (parsed.is_active) {
            setToken(storedToken);
            setUser(parsed);
          } else {
            sessionStorage.removeItem(TOKEN_KEY);
            sessionStorage.removeItem(USER_KEY);
          }
        } else {
          sessionStorage.removeItem(TOKEN_KEY);
          sessionStorage.removeItem(USER_KEY);
        }
      }
    } catch {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
    } finally {
      setRestoring(false);
    }
  }, []);

  const logout = useCallback((message = "") => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    setToken("");
    setUser(null);
    setActivePage("Overview");
    setSessionError(message);
  }, []);

  async function login(username: string, password: string) {
    let response: Response;

    try {
      response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new Error(
        `Cannot connect to ${API_URL}. Start the FastAPI backend and try again.`,
      );
    }

    if (!response.ok) {
      let message =
        response.status === 401
          ? "Incorrect username or password."
          : response.status === 403
            ? "This account is disabled. Contact your administrator."
            : `Sign in failed (${response.status}).`;

      try {
        const body = (await response.json()) as {
          detail?: string | { msg?: string }[];
        };

        if (typeof body.detail === "string" && response.status !== 401) {
          message = body.detail;
        } else if (Array.isArray(body.detail)) {
          message = body.detail
            .map((item) => item.msg || "Invalid input")
            .join(", ");
        }
      } catch {
        // Retain the default message.
      }

      throw new Error(message);
    }

    const data = (await response.json()) as LoginResponse;

    if (
      !data.access_token ||
      !data.user ||
      typeof data.user.username !== "string" ||
      typeof data.user.role !== "string" ||
      typeof data.user.is_active !== "boolean"
    ) {
      throw new Error("The backend returned an invalid login response.");
    }

    if (!data.user.is_active) {
      throw new Error("This account is disabled.");
    }

    try {
      sessionStorage.setItem(TOKEN_KEY, data.access_token);
      sessionStorage.setItem(USER_KEY, JSON.stringify(data.user));
    } catch {
      throw new Error(
        "The browser could not store this session. Check your privacy settings.",
      );
    }

    setSessionError("");
    setToken(data.access_token);
    setUser(data.user);
    setActivePage("Overview");
  }

  const handleUnauthorized = useCallback(() => {
    logout("Your session has expired. Please sign in again.");
  }, [logout]);

  if (restoring) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#09090b]">
        <div className="flex flex-col items-center gap-4">
          <Brand />
          <LoaderCircle size={20} className="animate-spin text-zinc-500" />
          <p className="text-xs text-zinc-500">Preparing secure workspace...</p>
        </div>
      </main>
    );
  }

  if (!user || !token) {
    return (
      <>
        {sessionError && (
          <div className="fixed left-4 right-4 top-4 z-50 mx-auto max-w-md">
            <ErrorBanner
              message={sessionError}
              onClose={() => setSessionError("")}
            />
          </div>
        )}
        <LoginScreen onLogin={login} />
      </>
    );
  }

  const role = user.role.replaceAll("_", " ");

  return (
    <div className="app-shell min-h-screen md:flex">
      {mobileOpen && (
        <button
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-40 bg-black/70 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`sidebar fixed inset-y-0 left-0 z-50 flex w-[255px] flex-col px-4 py-5 transition-transform duration-200 md:sticky md:top-0 md:h-screen md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-2">
          <Brand />
          <button
            className="rounded-lg p-2 text-zinc-500 hover:bg-white/5 hover:text-white md:hidden"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-8 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.07]">
              <ShieldCheck size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-zinc-200">
                Control Center
              </p>
              <p className="mt-1 truncate text-[10px] text-zinc-500">{role}</p>
            </div>
          </div>
        </div>

        <nav className="mt-7 flex-1 space-y-6 overflow-y-auto">
          {NAVIGATION.map((group) => (
            <div key={group.group}>
              <p className="mb-2 px-3 text-[9px] font-semibold tracking-[0.18em] text-zinc-600">
                {group.group}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = activePage === item.label;
                  const restricted =
                    item.label !== "Overview" &&
                    item.label !== "Companies";

                  return (
                    <button
                      key={item.label}
                      onClick={() => {
                        setActivePage(item.label);
                        setMobileOpen(false);
                      }}
                      className={`nav-item ${active ? "active" : ""}`}
                      title={
                        restricted
                          ? "Module UI placeholder; API integration pending"
                          : item.label
                      }
                    >
                      <Icon size={17} strokeWidth={1.8} />
                      <span className="flex-1 text-[12px]">{item.label}</span>
                      {active && (
                        <span className="h-1.5 w-1.5 rounded-full bg-zinc-200" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-5 border-t border-white/[0.07] pt-4">
          <div className="mb-3 flex items-center gap-2.5 px-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.045] text-xs font-semibold">
              {user.username.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-zinc-200">
                {user.username}
              </p>
              <p className="mt-1 truncate text-[10px] text-zinc-500">
                {user.email || role}
              </p>
            </div>
          </div>
          <button onClick={() => logout()} className="nav-item">
            <LogOut size={16} />
            <span className="text-xs">Sign out</span>
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between gap-3 border-b border-white/[0.07] bg-[#09090b]/90 px-4 backdrop-blur-xl sm:px-7 lg:px-9">
          <div className="flex min-w-0 items-center gap-3">
            <button
              aria-label="Open navigation"
              className="rounded-lg border border-white/[0.08] p-2 text-zinc-300 md:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={18} />
            </button>
            <span className="truncate text-sm font-medium text-zinc-100">
              {activePage}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2 lg:flex">
              <Search size={14} className="text-zinc-500" />
              <span className="text-[11px] text-zinc-500">Workspace</span>
            </div>
            <div className="hidden text-right sm:block">
              <p className="max-w-[160px] truncate text-xs font-medium text-zinc-200">
                {user.username}
              </p>
              <p className="mt-1 text-[10px] text-zinc-500">{role}</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-[10px] font-semibold sm:hidden">
              {user.username.slice(0, 2).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] px-4 py-7 sm:px-7 sm:py-9 lg:px-9">
          <div className="mb-7 flex items-center gap-2 text-[10px] tracking-[0.12em] text-zinc-500">
            <span className="status-dot" />
            WORKSPACE SESSION
            <span className="text-zinc-700">/</span>
            <span className="text-zinc-400">SECURE</span>
          </div>

          {activePage === "Overview" ? (
            <Overview
              user={user}
              token={token}
              onUnauthorized={handleUnauthorized}
              onOpenCompanies={() => setActivePage("Companies")}
            />
          ) : activePage === "Companies" ? (
            <CompanyManagement
              token={token}
              onUnauthorized={handleUnauthorized}
            />
          ) : (
            <section className="panel flex min-h-[350px] flex-col items-center justify-center px-6 py-14 text-center">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                <Fingerprint size={24} className="text-zinc-200" />
              </div>
              <h1 className="text-xl font-semibold text-white">
                {activePage}
              </h1>
              <p className="mt-2 max-w-md text-sm leading-6 text-zinc-400">
                This module has not been connected to its production API yet.
                Company Management is the first live-data integration.
              </p>
              <Button
                secondary
                onClick={() => setActivePage("Overview")}
              >
                Back to overview <ArrowRight size={14} />
              </Button>
            </section>
          )}

          <footer className="mt-10 flex flex-col justify-between gap-2 border-t border-white/[0.06] py-5 text-[10px] text-zinc-600 sm:flex-row sm:items-center">
            <span>
              © {new Date().getFullYear()} ApexiveAI. All rights reserved.
            </span>
            <span className="flex items-center gap-2">
              <span className="status-dot" />
              Authenticated workspace
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
