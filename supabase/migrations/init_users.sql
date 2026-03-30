-- 1. Custom Types for Governance & RBAC
CREATE TYPE app_role AS ENUM ('owner', 'admin', 'member', 'service_agent');
CREATE TYPE subscription_tier AS ENUM ('agile', 'sovereign');

-- 2. Organizations (The Multi-Tenancy Anchor)
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    tier subscription_tier DEFAULT 'agile' NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. Profiles (The Identity Layer)
-- Links Supabase Auth to the Pmu.sg Business Identity
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    bsuid TEXT UNIQUE, -- The Business User ID (WhatsApp number or Teams ID)
    full_name TEXT,
    avatar_url TEXT,
    is_verified BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 4. Organization Membership (Role Mapping)
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    role app_role DEFAULT 'member' NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(organization_id, user_id)
);

-- 5. Row Level Security (RLS) - "Security by Design"
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can only read/update their own profile
CREATE POLICY "Users can view own profile" ON profiles 
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles 
    FOR UPDATE USING (auth.uid() = id);

-- Organizations: Members can view their organization details
CREATE POLICY "Members can view their orgs" ON organizations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM organization_members 
            WHERE organization_id = organizations.id 
            AND user_id = auth.uid()
        )
    );

-- 6. Automation: Auto-create Profile on Signup
-- This ensures every auth user has a matching record in public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 7. Governance Indexing
CREATE INDEX idx_profiles_bsuid ON profiles(bsuid);
CREATE INDEX idx_org_members_user ON organization_members(user_id);