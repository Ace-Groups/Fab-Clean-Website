import { useEffect, useMemo, useState } from "react";
import { Link, Route, Switch, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { useGetOrder, useListOrders, useUpdateProfile } from "@workspace/api-client-react";
import {
  ArrowLeft,
  Bell,
  CalendarDays,
  ChevronRight,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  Phone,
  Plus,
  User,
  X,
} from "lucide-react";
import { AppLayout } from "@/components/layout";
import { StructuredAddressFields } from "@/components/structured-address-fields";
import { useAuth, useRequireAuth } from "@/hooks/use-auth";
import { Badge, Button, Card, FadeIn, Input, SectionHeading } from "@/components/ui";
import { StatusTimeline } from "@/components/site";
import {
  EMPTY_STRUCTURED_ADDRESS,
  formatStructuredAddress,
  isStructuredAddressComplete,
} from "@/lib/address";
import { fetchPortalPickups, fetchWalletSummary, type PortalPickup } from "@/lib/portal-api";

type ProfileFormValues = {
  name: string;
  email: string;
  addresses: string[];
};

const ORDER_STAGES = ["pending", "processing", "ready_for_pickup", "out_for_delivery", "delivered"] as const;

const ORDER_STAGE_LABELS: Record<(typeof ORDER_STAGES)[number], string> = {
  pending: "Order received",
  processing: "In cleaning",
  ready_for_pickup: "Ready for pickup",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
};

function formatMoney(value: number | string | null | undefined) {
  return `₹${Number(value ?? 0).toFixed(0)}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "Awaiting update";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Awaiting update";
  return format(date, "dd MMM yyyy, p");
}

function BackToDashboard() {
  return (
    <Link href="/dashboard" className="mb-6 inline-flex items-center text-sm font-medium text-muted-foreground hover:text-ink transition-colors">
      <ArrowLeft className="mr-2 h-4 w-4" />
      Back to dashboard
    </Link>
  );
}

function OrderCard({ order, index = 0 }: { order: any, index?: number }) {
  return (
    <FadeIn delay={index * 0.03}>
      <Link href={`/dashboard/track/${order.id}`}>
        <Card className="lux-card group relative p-6 transition-colors hover:border-primary/20 hover:bg-primary/[0.02]">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <p className="text-xl font-semibold text-ink">{order.reference}</p>
                <Badge variant="outline" className="bg-background/50">{order.status.replace(/_/g, " ")}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{formatDateTime(order.createdAt)} • {order.services.length || 0} items</p>
            </div>
            <div className="flex items-center gap-4 text-right">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Total</p>
                <p className="font-semibold text-ink">{formatMoney(order.totalAmount)}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
            </div>
          </div>
        </Card>
      </Link>
    </FadeIn>
  );
}

function PickupStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className="capitalize">
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

function BookingsPanel({ pickups, title = "Pickup bookings" }: { pickups: PortalPickup[]; title?: string }) {
  return (
    <Card className="lux-card p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-2xl text-ink">{title}</h3>
        <Link href="/schedule-pickup">
          <Button size="sm">New pickup</Button>
        </Link>
      </div>
      {!pickups.length ? (
        <p className="mt-4 text-sm text-muted-foreground">No pickup bookings yet.</p>
      ) : (
        <div className="mt-4 grid gap-3">
          {pickups.map((pickup) => (
            <div key={pickup.id} className="rounded-2xl border border-line bg-panel/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-ink">{pickup.bookingReference}</p>
                <PickupStatusBadge status={pickup.status} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {pickup.branch} • {pickup.preferredDate} • {pickup.timeSlot}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{pickup.address}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function DashboardHome() {
  const { token, logout } = useAuth();
  const [showBookingPopup, setShowBookingPopup] = useState(false);
  const ordersQuery = useListOrders();
  const walletQuery = useQuery({
    queryKey: ["wallet-summary"],
    queryFn: () => fetchWalletSummary(token!),
    enabled: Boolean(token),
  });
  const pickupsQuery = useQuery({
    queryKey: ["portal-pickups"],
    queryFn: () => fetchPortalPickups(token!),
    enabled: Boolean(token),
  });

  const orders = ordersQuery.data?.data ?? [];
  const activeOrdersCount = orders.filter((o) => o.status !== "delivered").length;
  const recentOrders = orders.slice(0, 3);
  const pickups = pickupsQuery.data?.data ?? [];
  const newPickupsCount = useMemo(() => {
    if (!pickups.length) return 0;
    const key = `fab_dashboard_pickup_seen_at`;
    const lastSeen = localStorage.getItem(key);
    const lastSeenDate = lastSeen ? new Date(lastSeen) : null;
    if (!lastSeenDate || Number.isNaN(lastSeenDate.getTime())) return pickups.length;
    return pickups.filter((row) => row.createdAt && new Date(row.createdAt) > lastSeenDate).length;
  }, [pickups]);
  
  const wallet = walletQuery.data?.data;

  useEffect(() => {
    if (newPickupsCount > 0) {
      setShowBookingPopup(true);
    }
  }, [newPickupsCount]);

  const markBookingsSeen = () => {
    localStorage.setItem("fab_dashboard_pickup_seen_at", new Date().toISOString());
    setShowBookingPopup(false);
  };

  return (
    <div className="space-y-10">
      {showBookingPopup && pickups.length > 0 ? (
        <Card className="lux-card border-primary/20 bg-primary/[0.04] p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-primary">New pickup booking updates</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {newPickupsCount} new booking{newPickupsCount === 1 ? "" : "s"} since your last login.
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/dashboard/bookings">
                <Button size="sm">
                  <CalendarDays className="mr-2 h-4 w-4" />
                  Open bookings
                </Button>
              </Link>
              <Button size="sm" variant="outline" onClick={markBookingsSeen}>
                Dismiss
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="cloth-panel p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Active orders</p>
          <p className="mt-2 font-display text-3xl text-ink">{ordersQuery.isLoading ? "…" : activeOrdersCount}</p>
        </div>
        <div className="cloth-panel p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Pickup bookings</p>
          <p className="mt-2 font-display text-3xl text-ink">{pickupsQuery.isLoading ? "…" : pickups.length}</p>
        </div>
        <div className="cloth-panel p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Wallet</p>
          <p className="mt-2 font-display text-3xl text-ink">{wallet ? formatMoney(wallet.balance) : "…"}</p>
        </div>
      </div>

      {/* Smart Quick Actions based on visitor intent */}
      <div className="grid gap-3 sm:grid-cols-3">
        {activeOrdersCount > 0 ? (
          <>
            <Link href="/dashboard/orders" className="block">
              <Button className="w-full h-14 text-base shadow-sm ring-2 ring-primary/20">Track Active Order</Button>
            </Link>
            <Link href="/schedule-pickup" className="block">
              <Button variant="outline" className="w-full h-14 text-base bg-panel">New Pickup</Button>
            </Link>
          </>
        ) : (
          <>
            <Link href="/schedule-pickup" className="block">
              <Button className="w-full h-14 text-base shadow-sm ring-2 ring-primary/20">Book Pickup</Button>
            </Link>
            <Link href="/dashboard/orders" className="block">
              <Button variant="outline" className="w-full h-14 text-base bg-panel">Order History</Button>
            </Link>
          </>
        )}
        <Link href="/dashboard/profile" className="block">
          <Button variant="outline" className="w-full h-14 text-base bg-panel">Profile & Settings</Button>
        </Link>
        <Link href="/dashboard/bookings" className="block">
          <Button variant="outline" className="w-full h-14 text-base bg-panel">
            <Bell className="mr-2 h-4 w-4" />
            Booking History
          </Button>
        </Link>
      </div>

      {/* Recent Orders */}
      <div>
        <div className="flex items-center justify-between mb-5 px-1">
          <h3 className="font-display text-2xl text-ink">Recent orders</h3>
          {orders.length > 3 && (
            <Link href="/dashboard/orders" className="text-sm font-medium text-primary hover:underline">
              View all
            </Link>
          )}
        </div>
        
        {ordersQuery.isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : recentOrders.length === 0 ? (
          <Card className="lux-card p-8 text-center bg-panel/50">
            <p className="text-lg text-ink font-medium">No orders yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Book your first pickup to get started.</p>
          </Card>
        ) : (
          <div className="grid gap-3">
            {recentOrders.map((order, i) => <OrderCard key={order.id} order={order} index={i} />)}
          </div>
        )}
      </div>
      
      {/* Sign Out */}
      <div className="pt-4 border-t border-line">
        <Button variant="ghost" onClick={logout} className="text-red-500 hover:text-red-600 hover:bg-red-50 -ml-2">
          <LogOut className="mr-2 h-4 w-4" />
          Sign out safely
        </Button>
      </div>
    </div>
  );
}

function BookingsPage() {
  const { token } = useAuth();
  const pickupsQuery = useQuery({
    queryKey: ["portal-pickups"],
    queryFn: () => fetchPortalPickups(token!),
    enabled: Boolean(token),
  });

  const pickups = pickupsQuery.data?.data ?? [];

  return (
    <div className="max-w-4xl space-y-6">
      <BackToDashboard />
      {pickupsQuery.isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <BookingsPanel pickups={pickups} title="All Pickup Bookings" />
      )}
    </div>
  );
}

function OrdersList() {
  const { data, isLoading, error } = useListOrders();

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl">
        <BackToDashboard />
        <Card className="lux-card p-6">
          <p className="font-display text-2xl text-ink">Unable to load orders.</p>
          <p className="mt-2 text-sm text-muted-foreground">Please try again shortly.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <BackToDashboard />
      <div className="mb-6 px-1">
        <h2 className="font-display text-3xl text-ink">All Orders</h2>
      </div>

      {!data?.data?.length ? (
        <Card className="lux-card p-8 text-center">
          <p className="text-lg font-medium text-ink">No orders found.</p>
          <div className="mt-4">
            <Link href="/schedule-pickup">
              <Button>Schedule pickup</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3">
          {data.data.map((order, index) => (
            <OrderCard key={order.id} order={order} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderTrack({ id }: { id: string }) {
  const { data, isLoading, error } = useGetOrder(id);

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="max-w-2xl">
        <BackToDashboard />
        <Card className="lux-card p-6">
          <p className="font-display text-2xl text-ink">Order not found.</p>
          <p className="mt-2 text-sm text-muted-foreground">This order is not available.</p>
        </Card>
      </div>
    );
  }

  const order = data.data;
  const currentIndex = Math.max(ORDER_STAGES.indexOf(order.status as (typeof ORDER_STAGES)[number]), 0);

  return (
    <div className="max-w-4xl space-y-6">
      <BackToDashboard />
      
      <Card className="lux-card p-6 md:p-8 border-t-4 border-t-primary">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-3xl text-ink">Order {order.reference}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Placed on {formatDateTime(order.createdAt)}</p>
          </div>
          <Badge className="w-fit text-sm px-3 py-1">{order.status.replace(/_/g, " ")}</Badge>
        </div>

        <div className="mt-10">
          <StatusTimeline
            activeIndex={currentIndex}
            steps={ORDER_STAGES.map((stage) => ({ label: ORDER_STAGE_LABELS[stage], meta: stage.replace(/_/g, " ") }))}
          />
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="lux-card p-6 md:p-8">
          <h3 className="font-medium text-ink mb-4">Service Details</h3>
          <div className="space-y-3">
            {(order.services.length ? order.services : ["Standard care"]).map((service, idx) => (
              <div key={idx} className="flex items-center gap-3 text-sm text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-primary/40" />
                {service}
              </div>
            ))}
          </div>
          <div className="mt-8 pt-6 border-t border-line">
            <p className="text-sm text-muted-foreground mb-1">Scheduled for</p>
            <p className="font-medium text-ink">{formatDateTime(order.scheduledDate)}</p>
          </div>
        </Card>

        <Card className="lux-card p-6 md:p-8 bg-panel/30">
          <h3 className="font-medium text-ink mb-6">Payment Summary</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="text-ink">{formatMoney(order.totalAmount)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Delivery</span>
              <span className="text-primary font-medium">Free</span>
            </div>
            <div className="pt-4 mt-4 border-t border-line flex justify-between items-center">
              <span className="font-medium text-ink">Total</span>
              <span className="text-2xl font-semibold text-ink">{formatMoney(order.totalAmount)}</span>
            </div>
          </div>
          
          <div className="mt-8">
            <Link href={`/feedback/${order.reference}`}>
              <Button variant="outline" className="w-full">Leave Feedback</Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

function ProfilePanel() {
  const queryClient = useQueryClient();
  const { profile } = useRequireAuth();
  
  const form = useForm<ProfileFormValues>({
    defaultValues: {
      name: profile?.name || "",
      email: profile?.email || "",
      addresses: (profile as any)?.addresses || [],
    },
  });

  const [draftAddress, setDraftAddress] = useState({ ...EMPTY_STRUCTURED_ADDRESS });
  const [showAddressErrors, setShowAddressErrors] = useState(false);
  const addresses = form.watch("addresses") || [];

  useEffect(() => {
    form.reset({
      name: profile?.name || "",
      email: profile?.email || "",
      addresses: (profile as any)?.addresses || [],
    });
  }, [form, profile?.email, profile?.name, (profile as any)?.addresses]);

  const updateProfile = useUpdateProfile({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ["/api/users/profile"] });
      },
    } as never,
  });

  const addAddress = () => {
    setShowAddressErrors(true);
    if (!isStructuredAddressComplete(draftAddress)) return;
    const composed = formatStructuredAddress(draftAddress);
    if (!composed) return;
    form.setValue("addresses", [...addresses, composed]);
    setDraftAddress({ ...EMPTY_STRUCTURED_ADDRESS });
    setShowAddressErrors(false);
  };

  const removeAddress = (index: number) => {
    form.setValue("addresses", addresses.filter((_, i) => i !== index));
  };

  return (
    <div className="max-w-2xl">
      <BackToDashboard />
      <div className="mb-6 px-1">
        <h2 className="font-display text-3xl text-ink">Profile & Settings</h2>
      </div>

      <Card className="lux-card p-6 md:p-8">
        <form className="space-y-6" onSubmit={form.handleSubmit((values) => updateProfile.mutate({ data: values }))}>
          <div>
            <label className="mb-2 block text-sm font-medium text-ink">Registered Phone</label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={profile?.phone || ""} readOnly className="pl-11 bg-background/50 text-muted-foreground cursor-not-allowed" />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">Phone number cannot be changed as it acts as your secure login ID.</p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-ink">Full Name</label>
            <div className="relative">
              <User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input {...form.register("name")} className="pl-11" placeholder="Your name" />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-ink">Email Address</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input {...form.register("email")} type="email" className="pl-11" placeholder="you@example.com" />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-ink">Saved Addresses</label>
            <div className="space-y-3">
              {addresses.map((addr, index) => (
                <div key={index} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-background/50 p-3">
                  <div className="flex items-start gap-3 overflow-hidden">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <p className="text-sm text-ink line-clamp-2">{addr}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAddress(index)}
                    className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              
              <div className="mt-4 rounded-2xl border border-line bg-background/40 p-4">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Add organized address
                </p>
                <StructuredAddressFields
                  value={draftAddress}
                  onChange={setDraftAddress}
                  showErrors={showAddressErrors}
                />
                <div className="mt-4">
                  <Button type="button" variant="outline" onClick={addAddress}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add address
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-line">
            <Button type="submit" isLoading={updateProfile.isPending}>Save Changes</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default function Dashboard() {
  const { profile, isLoading } = useRequireAuth();
  const [location] = useLocation();

  const greeting = useMemo(() => {
    const name = profile?.name ? profile.name.split(" ")[0] : "Customer";
    const hour = new Date().getHours();
    let timeGreeting = "Good evening";
    if (hour < 12) timeGreeting = "Good morning";
    else if (hour < 17) timeGreeting = "Good afternoon";
    return `${timeGreeting}, ${name}`;
  }, [profile?.name]);

  if (isLoading || !profile) return null;

  return (
    <AppLayout>
      <div className="page-shell bg-background/30 min-h-screen">
        <section className="container-wide section-padding">
          {location === "/dashboard" && (
            <SectionHeading
              align="left"
              title={greeting}
              subtitle="Orders, pickups, and a light profile — nothing you do not need."
            />
          )}
        </section>

        <section className="container-wide pb-24 -mt-4">
          <Switch>
            <Route path="/dashboard" component={DashboardHome} />
            <Route path="/dashboard/orders" component={OrdersList} />
            <Route path="/dashboard/track/:id">{(params) => <OrderTrack id={params.id} />}</Route>
            <Route path="/dashboard/bookings" component={BookingsPage} />
            <Route path="/dashboard/profile" component={ProfilePanel} />
            {/* Redirect any old links */}
            <Route path="/dashboard/wallet">
               {() => { window.location.href = "/dashboard"; return null; }}
            </Route>
            <Route>{location.startsWith("/dashboard") ? <DashboardHome /> : null}</Route>
          </Switch>
        </section>
      </div>
    </AppLayout>
  );
}
