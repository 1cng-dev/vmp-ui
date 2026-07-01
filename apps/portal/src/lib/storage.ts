import { supabase } from './supabase'

export const uploadKYCDocument = async (
  file: File,
  userId: string,
  documentType: 'nrc_front' | 'nrc_back' | 'org_cert' | 'org_tax_id' | 'director_id'
) => {
  const fileExt = file.name.split('.').pop()
  const fileName = `${userId}/${documentType}.${fileExt}`
  
  const { data, error } = await supabase.storage
    .from('kyc-documents')
    .upload(fileName, file)

  if (error) {
    throw error
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('kyc-documents')
    .getPublicUrl(fileName)

  return publicUrl
}

export const deleteKYCDocument = async (fileName: string) => {
  const { error } = await supabase.storage
    .from('kyc-documents')
    .remove([fileName])

  if (error) {
    throw error
  }
}