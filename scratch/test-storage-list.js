import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  const { data: folders, error: folderError } = await supabaseAdmin.storage
    .from('patient-reports')
    .list();
  
  if (folderError) {
    console.error("Error listing root bucket:", folderError.message);
    return;
  }
  
  console.log("Root folders (Patient IDs):", folders);
  
  // List files inside the first folder if available
  if (folders && folders.length > 0) {
    const firstFolder = folders.find(f => f.id === null); // Folders don't have IDs in list() result, only name
    const folderName = folders[0].name;
    const { data: files, error: filesError } = await supabaseAdmin.storage
      .from('patient-reports')
      .list(folderName);
    
    if (filesError) {
      console.error(`Error listing folder ${folderName}:`, filesError.message);
    } else {
      console.log(`Files inside ${folderName}:`, files);
    }
  }
}

main();
