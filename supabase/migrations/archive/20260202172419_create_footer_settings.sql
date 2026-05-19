-- Create footer_content table for all footer pages
CREATE TABLE IF NOT EXISTS public.footer_content (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  page_type text NOT NULL UNIQUE CHECK (page_type = ANY (ARRAY['about_us'::text, 'statement_of_faith'::text, 'donate'::text, 'faq'::text, 'contact_us'::text, 'privacy_policy'::text, 'terms_of_use'::text])),
  title text NOT NULL,
  content text NOT NULL,
  
  CONSTRAINT footer_content_pkey PRIMARY KEY (id)
);

-- Insert default content for all footer pages (plain text format)
INSERT INTO public.footer_content (page_type, title, content) VALUES
  ('about_us', 'About Us', 'Our Mission

Harvest 21 exists to support missionaries as they bring the Gospel to unreached people groups around the world. We provide a platform that connects missionaries with supporters who share their vision.

Our Story

Founded with a passion for global missions, Harvest 21 has been facilitating meaningful connections between missionaries and their supporters, enabling effective ministry in challenging locations worldwide.

Our Values

We are committed to transparency, accountability, and excellence in supporting missionary work. Every dollar donated goes directly toward supporting missionaries and their vital work.'),
  
  ('statement_of_faith', 'Statement of Faith', 'The Bible

We believe the Bible is the inspired, infallible, and authoritative Word of God.

The Trinity

We believe in one God, eternally existent in three persons: Father, Son, and Holy Spirit.

Salvation

We believe in salvation through Jesus Christ alone, by grace through faith.

The Church

We believe in the universal church, the body of Christ, composed of all who trust in Jesus Christ as Savior and Lord.'),
  
  ('donate', 'Donate', 'Support Global Missions

Your generous donation helps missionaries share the Gospel around the world. Every contribution makes an eternal difference.

Why Donate?

Your support enables missionaries to reach unreached communities, share the Gospel, and make disciples of all nations. Through your partnership, missionaries can focus on their calling while knowing their practical needs are met.

Tax Deductible

Harvest 21 is a qualified IRS Section 501(c)(3) Organization. All donations are tax-deductible to the extent allowed by law. You will receive a receipt for your records.'),
  
  ('faq', 'Frequently Asked Questions', '{"items":[{"id":"faq-1","question":"What is Harvest 21?","answer":"Harvest 21 is a missionary support organization dedicated to helping missionaries reach unreached communities around the world. We provide a platform that connects missionaries with supporters who share their vision for spreading the Gospel."},{"id":"faq-2","question":"How can I support a missionary?","answer":"You can support missionaries through our platform by making one-time or recurring donations to missionaries of your choice. Simply browse our missionary profiles, select someone whose mission resonates with you, and set up your donation."},{"id":"faq-3","question":"Is my donation tax-deductible?","answer":"Yes, Harvest 21 is a qualified IRS Section 501(c)(3) Organization. All donations are tax-deductible to the extent allowed by law. You will receive a donation receipt for your tax records."},{"id":"faq-4","question":"How do I know my donation is being used properly?","answer":"We are committed to transparency and accountability. All donations go directly to support the missionaries you choose. We provide regular updates and reports on how funds are being used."}]}'),
  
  ('contact_us', 'Contact Us', 'Get in Touch

We would love to hear from you! Whether you have questions about supporting missionaries, need assistance with your account, or want to learn more about our ministry, our team is here to help.

Email: info@harvest21.org

Phone: +1 (555) 123-4567

Address: 123 Mission Street, City, State 12345

Office Hours: Monday - Friday, 9:00 AM - 5:00 PM EST'),
  
  ('privacy_policy', 'Privacy Policy', 'Last Updated: January 2024

Information We Collect

We collect information that you provide directly to us, including your name, email address, mailing address, phone number, and payment information when you make a donation or create an account.

How We Use Your Information

We use the information we collect to:
- Process your donations and send receipts
- Communicate with you about your account and donations
- Send updates about missionaries you support
- Improve our services and user experience
- Comply with legal obligations

Data Security

We implement appropriate technical and organizational security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. All payment information is processed through secure, encrypted channels.

Information Sharing

We do not sell, trade, or rent your personal information to third parties. We may share information with service providers who assist us in operating our platform, conducting our business, or serving our users, as long as those parties agree to keep this information confidential.

Your Rights

You have the right to access, correct, or delete your personal information. You may also opt out of receiving promotional communications from us at any time.

Contact Us

If you have questions about this Privacy Policy, please contact us at privacy@harvest21.org'),
  
  ('terms_of_use', 'Terms of Use', 'Last Updated: January 2024

Acceptance of Terms

By accessing and using the Harvest 21 website and services, you accept and agree to be bound by these Terms of Use. If you do not agree to these terms, please do not use our services.

Use of Service

You agree to use our service only for lawful purposes and in accordance with these terms. You may not use our service:
- In any way that violates any applicable federal, state, local, or international law
- To transmit any unauthorized advertising or promotional material
- To impersonate or attempt to impersonate Harvest 21 or any other person or entity

Donations

All donations made through our platform are final and non-refundable unless required by law. Donations are tax-deductible to the extent allowed by law. You will receive a receipt for your donation.

Account Responsibilities

If you create an account, you are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account.

Intellectual Property

All content on this website, including text, graphics, logos, and images, is the property of Harvest 21 or its content suppliers and is protected by copyright and other intellectual property laws.

Limitation of Liability

Harvest 21 shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the service.

Changes to Terms

We reserve the right to modify these terms at any time. We will notify users of any material changes by posting the new Terms of Use on this page.

Contact Us

If you have questions about these Terms of Use, please contact us at legal@harvest21.org')
ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE public.footer_content ENABLE ROW LEVEL SECURITY;

-- RLS Policies for footer_content (public read, admin write)
CREATE POLICY "Anyone can view footer content"
  ON public.footer_content FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert footer content"
  ON public.footer_content FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update footer content"
  ON public.footer_content FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins can delete footer content"
  ON public.footer_content FOR DELETE
  USING (public.is_admin());

