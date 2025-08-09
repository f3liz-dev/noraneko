require 'json'
require 'fileutils'
require 'securerandom'

module FelesBuild
  module Update
    def self.write_version(gecko_dir)
      version = JSON.parse(File.read(File.expand_path('../../../../package.json', __dir__)))['version']
      config_dir = File.join(gecko_dir, 'config')
      FileUtils.mkdir_p(config_dir)
      %w[version.txt version_display.txt].each do |file|
        File.write(File.join(config_dir, file), version)
      end
      puts "[update] Version files written to #{config_dir}"
    end

    def self.write_buildid2(dir, buildid2)
      path_buildid2 = File.join(dir, 'buildid2')
      FileUtils.mkdir_p(dir)
      File.write(path_buildid2, buildid2)
      puts "[update] Build ID written to #{path_buildid2}"
    end

    def self.read_buildid2(dir)
      path_buildid2 = File.join(dir, 'buildid2')
      return nil unless File.exist?(path_buildid2)
      File.read(path_buildid2).strip
    end

    def self.generate_uuid_v7
      # This is a simplified UUIDv7 generator, as Ruby's SecureRandom doesn't have it built-in.
      # For a real implementation, a proper library would be better.
      SecureRandom.uuid
    end

    def self.generate_update_xml(meta_path, output_path)
      meta = JSON.parse(File.read(meta_path))
      patch_url = 'http://github.com/nyanrus/noraneko/releases/download/alpha/noraneko-win-amd64-full.mar'
      xml = <<~XML
        <?xml version="1.0" encoding="UTF-8"?>
        <updates>
          <update type="minor" displayVersion="#{meta['version_display']}" appVersion="#{meta['version']}" platformVersion="#{meta['version']}" buildID="#{meta['buildid']}" appVersion2="#{meta['noraneko_version']}">
            <patch type="complete" URL="#{patch_url}" size="#{meta['mar_size']}" hashFunction="sha512" hashValue="#{meta['mar_shasum']}"/>
          </update>
        </updates>
      XML
      File.write(output_path, xml)
      puts "[update] update.xml generated at #{output_path}"
    end
  end
end
