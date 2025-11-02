// SPDX-License-Identifier: MPL-2.0
/**
 * Generate update.xml for Firefox/Noraneko update system
 * Usage: deno run -A xml.ts <meta.json path> <output.xml path>
 */

interface MetaData {
  version: string;
  noraneko_version: string;
  noraneko_buildid: string;
  mar_size: string;
  mar_shasum: string;
  buildid: string;
}

async function generateUpdateXML(
  metaJsonPath: string,
  outputXmlPath: string,
): Promise<void> {
  // Read meta.json
  const metaContent = await Deno.readTextFile(metaJsonPath);
  const meta: MetaData = JSON.parse(metaContent);

  // Extract directory from output path to determine platform
  const platform = outputXmlPath.includes("WINNT")
    ? "WINNT_x86_64-msvc-x64"
    : "Linux_x86_64-gcc3";

  // Construct MAR file URL (relative to where the XML will be hosted)
  const marFileName = `noraneko-${
    platform.includes("WINNT") ? "windows" : "linux"
  }-x64-full.mar`;

  // Generate update XML
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<updates>
  <update type="minor" displayVersion="${meta.noraneko_version}@${meta.version}" appVersion="${meta.version}" platformVersion="${meta.version}" buildID="${meta.buildid}">
    <patch type="complete" URL="${marFileName}" hashFunction="SHA512" hashValue="${meta.mar_shasum}" size="${meta.mar_size}"/>
  </update>
</updates>
`;

  // Write output XML
  await Deno.writeTextFile(outputXmlPath, xml);
  console.log(`✅ Generated update XML at: ${outputXmlPath}`);
  console.log(`   Platform: ${platform}`);
  console.log(`   Version: ${meta.noraneko_version}@${meta.version}`);
  console.log(`   BuildID: ${meta.buildid}`);
}

// Main execution
if (import.meta.main) {
  const args = Deno.args;
  if (args.length !== 2) {
    console.error("Usage: deno run -A xml.ts <meta.json path> <output.xml path>");
    Deno.exit(1);
  }

  const [metaJsonPath, outputXmlPath] = args;

  try {
    await generateUpdateXML(metaJsonPath, outputXmlPath);
  } catch (error) {
    console.error("Error generating update XML:", error);
    Deno.exit(1);
  }
}
