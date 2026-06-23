-- Public tenant logo storage.
-- Path convention: {tenant_id}/logo-{timestamp}.{ext}

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tenant-logos',
  'tenant-logos',
  true,
  2097152,
  ARRAY['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS tenant_logos_public_read ON storage.objects;
CREATE POLICY tenant_logos_public_read ON storage.objects
  FOR SELECT
  USING (bucket_id = 'tenant-logos');

DROP POLICY IF EXISTS tenant_logos_manager_insert ON storage.objects;
CREATE POLICY tenant_logos_manager_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'tenant-logos'
    AND (storage.foldername(name))[1]::UUID = public.tenant_id()
    AND public.is_manager()
  );

DROP POLICY IF EXISTS tenant_logos_manager_update ON storage.objects;
CREATE POLICY tenant_logos_manager_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'tenant-logos'
    AND (storage.foldername(name))[1]::UUID = public.tenant_id()
    AND public.is_manager()
  )
  WITH CHECK (
    bucket_id = 'tenant-logos'
    AND (storage.foldername(name))[1]::UUID = public.tenant_id()
    AND public.is_manager()
  );

DROP POLICY IF EXISTS tenant_logos_manager_delete ON storage.objects;
CREATE POLICY tenant_logos_manager_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'tenant-logos'
    AND (storage.foldername(name))[1]::UUID = public.tenant_id()
    AND public.is_manager()
  );
