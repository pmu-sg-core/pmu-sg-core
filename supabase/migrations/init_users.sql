-- Enable UUID and hashing extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Organizations for SME/Enterprise multi-tenancy
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  tier TEXT DEFAULT 'lite' CHECK (tier IN ('lite', 'pro', 'shield')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles mapping WhatsApp/System IDs to BSUID
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  bsuid TEXT UNIQUE NOT NULL, -- Business Service User ID for IMDA traceability
  whatsapp_id TEXT UNIQUE,     -- The @g.us or phone identifier
  org_id UUID REFERENCES organizations(id),
  full_name TEXT,
  role TEXT DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for Sovereign Compliance
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only view their own org profiles" 
ON profiles FOR SELECT USING (org_id = (SELECT org_id FROM profiles WHERE id = auth.uid()));


