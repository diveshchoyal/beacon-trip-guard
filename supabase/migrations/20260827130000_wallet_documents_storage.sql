-- Create private storage bucket for wallet documents if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'wallet-documents',
  'wallet-documents',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for wallet-documents bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can upload own wallet documents'
  ) THEN
    CREATE POLICY "Users can upload own wallet documents"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'wallet-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can view own wallet documents'
  ) THEN
    CREATE POLICY "Users can view own wallet documents"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'wallet-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can update own wallet documents'
  ) THEN
    CREATE POLICY "Users can update own wallet documents"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'wallet-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can delete own wallet documents'
  ) THEN
    CREATE POLICY "Users can delete own wallet documents"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'wallet-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
END $$;
