import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { useSubmitContact } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { Button, FadeIn, Input, SectionHeading, Textarea } from "@/components/ui";
import { ActionList, SupportBand } from "@/components/site";
import { BRAND } from "@/lib/brand";
import { useNearestStore } from "@/hooks/use-nearest-store";
import { useToast } from "@/hooks/use-toast";

const contactSchema = z.object({
  name: z.string().min(2, "Please enter your name"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().optional(),
  subject: z.string().optional(),
  message: z.string().min(10, "Please enter a short message"),
});

type ContactForm = z.infer<typeof contactSchema>;

export default function Contact() {
  const { storesNearestFirst, nearestStore } = useNearestStore({ requestOnMount: true });
  const { toast } = useToast();

  const { mutate: submitForm, isPending } = useSubmitContact({
    mutation: {
      onSuccess: () => {
        toast({ title: "Message sent", description: "The team will get back to you shortly." });
        reset();
      },
      onError: () => {
        toast({ title: "Unable to send message", description: "Please try again in a moment.", variant: "destructive" });
      },
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactForm>({
    resolver: zodResolver(contactSchema),
  });

  return (
    <AppLayout>
      <SEO
        title="Contact Fab Clean"
        description="Reach Fab Clean by phone, WhatsApp, email, or branch visit with a cleaner support layout."
        canonical="https://myfabclean.com/contact"
      />

      <div className="page-shell">
        <section className="container-wide section-padding">
          <SectionHeading title="Get in touch with us." subtitle="Contact" />
          <p className="mx-auto mt-6 max-w-3xl text-center text-lg leading-8 text-muted-foreground">
            Use the form for general inquiries. Use phone or WhatsApp for immediate assistance regarding pickups, branch availability, or orders.
          </p>
        </section>

        <section className="container-wide pb-20">
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <FadeIn>
              <div className="visual-card p-7">
                <h2 className="font-display text-4xl text-ink">Send a message</h2>
                <p className="mt-4 text-base leading-8 text-muted-foreground">
                  Send us a message and our team will get back to you shortly.
                </p>

                <form
                  onSubmit={handleSubmit((values) => submitForm({ data: values }))}
                  className="mt-8 grid gap-4"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Input placeholder="Your name" {...register("name")} />
                      {errors.name ? <p className="mt-2 text-sm text-red-700">{errors.name.message}</p> : null}
                    </div>
                    <div>
                      <Input placeholder="Your email" {...register("email")} />
                      {errors.email ? <p className="mt-2 text-sm text-red-700">{errors.email.message}</p> : null}
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input placeholder="Phone number" {...register("phone")} />
                    <Input placeholder="Subject" {...register("subject")} />
                  </div>
                  <div>
                    <Textarea placeholder="Tell us how we can help." {...register("message")} />
                    {errors.message ? <p className="mt-2 text-sm text-red-700">{errors.message.message}</p> : null}
                  </div>
                  <Button type="submit" isLoading={isPending} className="w-full sm:w-fit">
                    Send message
                  </Button>
                </form>
              </div>
            </FadeIn>

            <div className="space-y-6">
              <FadeIn delay={0.05}>
                <ActionList
                  items={[
                    {
                      icon: Phone,
                      title: "Call the team",
                      body: "Give us a call at our main branch for any immediate inquiries.",
                    },
                    {
                      icon: Mail,
                      title: "Email support",
                      body: `${BRAND.email} or ${BRAND.emailAlt} for formal support communication.`,
                    },
                    {
                      icon: MessageCircle,
                      title: "WhatsApp first",
                      body: "Best for quick pickup questions, branch timing, and order follow-up.",
                    },
                  ]}
                />
              </FadeIn>

              <FadeIn delay={0.1}>
                <div className="visual-card p-7">
                  <p className="eyebrow">Branch coverage</p>
                  <div className="mt-6 space-y-5">
                    {storesNearestFirst.map((branch) => (
                      <div key={branch.slug} className="rounded-[1.5rem] border border-line bg-background/70 px-5 py-5">
                        <p className="font-medium text-ink">
                          {branch.name}
                          {branch.slug === nearestStore?.slug ? (
                            <span className="ml-2 text-xs font-normal text-primary">(nearest to you)</span>
                          ) : null}
                        </p>
                        <p className="mt-2 text-sm leading-7 text-muted-foreground">{branch.address}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </FadeIn>
            </div>
          </div>
        </section>

        <section className="container-wide pb-24">
          <SupportBand title="Prefer the faster route?" description="Message Fab Clean on WhatsApp for pickup timing, basic pricing, or a quick branch question." />
        </section>
      </div>
    </AppLayout>
  );
}
