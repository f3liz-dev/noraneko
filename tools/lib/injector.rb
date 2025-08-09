require 'fileutils'
require_relative './defines'

module FelesBuild
  module Injector
    include Defines
    @logger = FelesBuild::Utils::Logger.new('injector')

    def self.run(mode, dir_name = 'noraneko')
      manifest_path = File.join(Defines::BIN_DIR, 'chrome.manifest')
      if mode != 'prod'
        manifest = File.read(manifest_path)
        entry = "manifest #{dir_name}/noraneko.manifest"
        File.write(manifest_path, "#{manifest}\n#{entry}") unless manifest.include?(entry)
      end

      dir_path = File.join(Defines::BIN_DIR, dir_name)
      FileUtils.rm_rf(dir_path)
      FileUtils.mkdir_p(dir_path)
      File.write(File.join(dir_path, 'noraneko.manifest'), <<~MANIFEST)
        content noraneko content/ contentaccessible=yes
        content noraneko-startup startup/ contentaccessible=yes
        skin noraneko classic/1.0 skin/
        resource noraneko resource/ contentaccessible=yes
        #{mode != 'dev' ? "\ncontent noraneko-settings settings/ contentaccessible=yes" : ''}
      MANIFEST

      [
        ['content', 'src/core/glue/loader-features/_dist'],
        ['startup', 'src/core/glue/startup/_dist'],
        ['skin', 'src/themes/_dist'],
        ['resource', 'src/core/glue/loader-modules/_dist']
      ].each do |subdir, target|
        FileUtils.ln_sf(File.expand_path(target, Dir.pwd), File.expand_path(File.join(dir_path, subdir), Dir.pwd))
      end
      @logger.success "Manifest injected successfully."
    end

    def self.inject_xhtml(is_dev)
        require 'rexml/document'

        # Inject noraneko script into browser.xhtml
        path_browser_xhtml = File.join(Defines::BIN_DIR, 'browser/chrome/browser/content/browser/browser.xhtml')
        doc = REXML::Document.new(File.read(path_browser_xhtml))

        doc.elements.delete_all("//*[@data-geckomixin]")

        script = REXML::Element.new("script")
        script.add_attributes({
            "type" => "module",
            "src" => "chrome://noraneko-startup/content/chrome_root.js",
            "async" => "async",
            "data-geckomixin" => ""
        })
        doc.root.elements['head'].add_element(script)

        if is_dev
            # Relax CSP for development
            meta = doc.elements["//meta[@http-equiv='Content-Security-Policy']"]
            if meta
                meta.attributes['content'] = "script-src chrome: moz-src: resource: http://localhost:* 'report-sample'"
            end
        end

        File.write(path_browser_xhtml, doc.to_s)
        @logger.success "Injected script into browser.xhtml"

        if is_dev
            # Also relax CSP for preferences.xhtml in development
            path_preferences_xhtml = File.join(Defines::BIN_DIR, 'browser/chrome/browser/content/browser/preferences/preferences.xhtml')
            doc_pref = REXML::Document.new(File.read(path_preferences_xhtml))
            meta_pref = doc_pref.elements["//meta"]
            if meta_pref
                meta_pref.attributes['content'] = "default-src chrome: http://localhost:* ws://localhost:*; img-src chrome: moz-icon: https: blob: data:; style-src chrome: data: 'unsafe-inline'; object-src 'none'"
            end
            File.write(path_preferences_xhtml, doc_pref.to_s)
            @logger.success "Relaxed CSP for preferences.xhtml"
        end
    end
  end
end
