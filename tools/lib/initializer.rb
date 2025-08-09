require 'fileutils'
require_relative './defines'

module FelesBuild
  module Initializer
    include Defines
    @logger = FelesBuild::Utils::Logger.new('initializer')

    def self.run
      has_version = File.exist?(Defines::BIN_VERSION)
      has_bin = File.exist?(Defines::BIN_PATH_EXE)
      need_init = false

      if has_bin && has_version
        version = File.read(Defines::BIN_VERSION).strip
        if Defines::VERSION != version
          @logger.warn "Version mismatch: #{version} !== #{Defines::VERSION}. Re-extracting."
          FileUtils.rm_rf(Defines::BIN_ROOT_DIR)
          need_init = true
        else
          @logger.info 'Binary version matches. No initialization needed.'
        end
      elsif has_bin && !has_version
        @logger.info "Binary exists but version file is missing. Writing #{Defines::VERSION}."
        FileUtils.mkdir_p(Defines::BIN_DIR)
        File.write(Defines::BIN_VERSION, Defines::VERSION)
        @logger.success 'Initialization complete.'
      elsif !has_bin && has_version
        @logger.error 'Version file exists but binary is missing. Abnormal termination.'
        raise 'Unreachable: !has_bin && has_version'
      else
        @logger.info 'Binary not found. Extracting.'
        need_init = true
      end

      if need_init
        FileUtils.mkdir_p(Defines::BIN_DIR)
        decompress_bin
        @logger.success 'Initialization complete.'
      end
    end

    def self.decompress_bin
      bin_archive = Defines.get_bin_archive
      @logger.info "Binary extraction started: #{bin_archive[:filename]}"
      unless File.exist?(bin_archive[:filename])
        @logger.warn "#{bin_archive[:filename]} not found. Downloading from GitHub release."
        download_bin(bin_archive[:filename])
      end

      case Defines::PLATFORM
      when 'windows'
        @logger.info '[stub] Windows extraction (Expand-Archive)'
      when 'darwin'
        @logger.info '[stub] macOS extraction (hdiutil, xattr, etc.)'
      when 'linux'
        system('tar', '-xf', bin_archive[:filename], '-C', Defines::BIN_ROOT_DIR)
        system('chmod', '-R', '755', Defines::PATHS[:bin_root])
      end

      File.write(Defines::BIN_VERSION, Defines::VERSION)
      @logger.success 'Extraction complete!'
    rescue => e
      @logger.error "Error during extraction: #{e.message}"
      exit 1
    end

    def self.download_bin(filename)
        require 'net/http'
        require 'uri'

        url = "https://github.com/nyanrus/noraneko/releases/download/alpha/#{filename}"
        uri = URI(url)

        @logger.info "Downloading binary from #{url}"

        Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == 'https') do |http|
            request = Net::HTTP::Get.new uri
            http.request request do |response|
                open filename, 'wb' do |io|
                    response.read_body do |chunk|
                        io.write chunk
                    end
                end
            end
        end
        @logger.success "Downloaded binary to #{filename}"
    end
  end
end
