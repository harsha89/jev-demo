// Template-based generator for "Try your own email" examples.
// Each call fills random names/companies/amounts/dates, so every example is different.

export type ExampleKind = "marketing" | "finance" | "sales" | "customer_support" | "other" | "spam";
export const EXAMPLE_KINDS: ExampleKind[] = ["marketing", "finance", "sales", "customer_support", "other", "spam"];

export type Example = { kind: ExampleKind; subject: string; body: string };

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const int = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));
const money = (lo: number, hi: number) => `$${int(lo, hi).toLocaleString("en-US")}.${String(int(0, 99)).padStart(2, "0")}`;

const FIRST = ["Sarah", "James", "Priya", "Liam", "Mei", "Carlos", "Aisha", "Tom", "Elena", "Kenji", "Grace", "Omar"];
const LAST = ["Nguyen", "Patel", "Smith", "Okafor", "Rossi", "Kim", "Fischer", "Lopez", "Brown", "Haddad"];
const COMPANY = ["Northwind Traders", "Bluegum Analytics", "Acme Logistics", "Riverstone Energy", "Kestrel Software",
  "Harbourline Foods", "Summit Health", "Lumen Retail", "Orbit Telecom", "Greenfield Supplies"];
const PRODUCT = ["CloudSync Pro", "the Analytics Suite", "SmartDesk licences", "the Premium plan", "FleetTrack sensors",
  "the Enterprise bundle", "SecureVault backup", "the Starter kit"];
const MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function ctx() {
  const first = pick(FIRST), last = pick(LAST);
  return {
    name: `${first} ${last}`, first, company: pick(COMPANY), product: pick(PRODUCT),
    amount: money(200, 48000), small: money(9, 400), order: `${pick(["ORD", "INV", "PO"])}-${int(10000, 99999)}`,
    ticket: `#${int(100000, 999999)}`, date: `${int(1, 28)} ${pick(MONTH)}`, pct: int(10, 60), qty: pick([25, 50, 100, 250, 500]),
    quarter: `Q${int(1, 4)}`,
  };
}

type C = ReturnType<typeof ctx>;
const T: Record<ExampleKind, ((c: C) => [string, string])[]> = {
  marketing: [
    (c) => [`${c.pct}% off ${c.product} — this week only`,
      `Hi ${c.first},\n\nOur spring campaign is live! For a limited time, get ${c.pct}% off ${c.product} when you upgrade before ${c.date}.\n\nSee what's new in our latest release and why 2,000+ teams switched this year.\n\nThe ${c.company} team\nUnsubscribe | Manage preferences`],
    (c) => [`${c.company} newsletter: what's new this month`,
      `In this issue:\n• Product update: ${c.product} now integrates with your CRM\n• Customer story: how a retail chain cut costs by ${c.pct}%\n• Webinar on ${c.date}: building a data-driven marketing plan\n\nRegister for the webinar today — seats are limited.`],
    (c) => [`You're invited: ${c.company} product launch on ${c.date}`,
      `Dear ${c.first},\n\nJoin us for the launch of ${c.product}. Live demos, early-bird pricing and a Q&A with our product team.\n\nRSVP by replying to this email or via the link below.\n\nWarm regards,\n${c.name}, Marketing Manager`],
  ],
  finance: [
    (c) => [`Invoice ${c.order} due ${c.date}`,
      `Hi ${c.first},\n\nPlease find attached invoice ${c.order} for ${c.amount}, payable by ${c.date}. Payment can be made by bank transfer to the account on the invoice.\n\nLet me know if you need a purchase order reference added.\n\nRegards,\n${c.name}\nAccounts Receivable, ${c.company}`],
    (c) => [`${c.quarter} budget variance report`,
      `Team,\n\nAttached is the ${c.quarter} budget variance report. Operating expenses came in ${c.pct}% over forecast, mainly travel and contractor costs. Revenue was ${c.amount} above plan.\n\nPlease review your cost centre lines before Friday's finance meeting.\n\n${c.name}, Financial Controller`],
    (c) => [`Reimbursement approved — ${c.small}`,
      `Hi ${c.first},\n\nYour expense claim ${c.order} for ${c.small} has been approved and will be paid in the next payroll run on ${c.date}.\n\nThanks,\nFinance Operations`],
  ],
  sales: [
    (c) => [`Quote request: ${c.qty} seats of ${c.product}`,
      `Hello,\n\nWe're evaluating ${c.product} for our team at ${c.company}. Could you send a quote for ${c.qty} seats on an annual contract, including volume discounts and onboarding?\n\nWe'd like to make a decision by ${c.date}.\n\nBest,\n${c.name}, Procurement Lead`],
    (c) => [`Following up on our demo — next steps`,
      `Hi ${c.first},\n\nThanks for your time on the demo yesterday. As discussed, I've attached a proposal for ${c.product} at ${c.amount} per year with a ${c.pct}% first-year discount if signed by ${c.date}.\n\nHappy to set up a call with your legal team to review the contract.\n\n${c.name}\nAccount Executive, ${c.company}`],
    (c) => [`Partnership opportunity with ${c.company}`,
      `Dear ${c.first},\n\nI lead business development at ${c.company}. We see a strong fit between our distribution network and your product line, and would like to discuss a reseller partnership.\n\nWould you be open to a 30-minute call next week?\n\nKind regards,\n${c.name}`],
  ],
  customer_support: [
    (c) => [`Order ${c.order} hasn't arrived`,
      `Hi,\n\nI placed order ${c.order} on ${c.date} and the tracking hasn't updated in over a week. Can you check where it is? I need it for a client project.\n\nThanks,\n${c.name}`],
    (c) => [`Can't log in to my account`,
      `Hello support,\n\nSince this morning I get "invalid session" every time I log in to ${c.product}, even after resetting my password twice. I'm on the latest version of Chrome.\n\nCould you help? This is blocking our whole team.\n\n${c.name}, ${c.company}`],
    (c) => [`Re: Ticket ${c.ticket} — charged twice`,
      `Hi ${c.first},\n\nThanks for raising ticket ${c.ticket}. I can confirm you were charged ${c.small} twice for your subscription. We've issued a refund for the duplicate payment, which should appear within 5 business days.\n\nSorry for the inconvenience.\n\n${c.name}\nCustomer Support, ${c.company}`],
  ],
  other: [
    (c) => [`Team offsite on ${c.date}`,
      `Hi all,\n\nA reminder that our team offsite is on ${c.date}. We'll start at 9:30 with a planning session, then lunch and a walk by the river in the afternoon.\n\nPlease let me know about any dietary requirements by Friday.\n\nCheers,\n${c.name}`],
    (c) => [`Office move — new desk allocations`,
      `Hello everyone,\n\nFacilities will move our floor to Level ${int(2, 9)} over the weekend of ${c.date}. Please pack personal items into the labelled crates by Thursday afternoon. Your new desk number will be emailed on Monday.\n\nThanks for your patience,\n${c.name}, Office Manager`],
    (c) => [`Happy birthday ${c.first}!`,
      `Hey ${c.first},\n\nHappy birthday from all of us! There's cake in the kitchen at 3pm — come by and say hi.\n\n${c.name} and the team`],
    (c) => [`Reminder: complete your annual compliance training`,
      `Hi ${c.first},\n\nOur records show your annual workplace safety and privacy training is still outstanding. Please complete both modules in the learning portal by ${c.date}.\n\nPeople & Culture`],
  ],
  spam: [
    (c) => [`URGENT: Your account has been suspended`,
      `Dear customer,\n\nWe detected unusual activity on your account. To avoid permanent closure, verify your identity within 24 hours by clicking the secure link below and entering your password and card details.\n\nhttp://secure-verify-account.co/login\n\nSecurity Team`],
    (c) => [`Congratulations ${c.first}!!! You've WON ${money(50000, 950000)}`,
      `You have been selected as the winner of our international lottery!!! To claim your prize send your full name, address and a processing fee of ${c.small} to our claims agent today. ACT NOW — offer expires in 48 hours!!!`],
    (c) => [`Cheap meds — no prescription needed`,
      `Best prices on v1agra, c1alis and more. ${c.pct}% OFF all orders, discreet worldwide shipping, no prescription required!!! Click here to order now >>> www.best-pharma-deals.biz`],
    (c) => [`Make ${money(5000, 20000)} a week from home`,
      `Tired of your 9-5? Our proven system lets ANYONE earn thousands per week working just 2 hours a day. No experience needed. Limited spots — sign up free today and start earning tomorrow!`],
  ],
};

export function generateExample(kind?: ExampleKind): Example {
  const k = kind ?? pick(EXAMPLE_KINDS);
  const [subject, body] = pick(T[k])(ctx());
  return { kind: k, subject, body };
}
