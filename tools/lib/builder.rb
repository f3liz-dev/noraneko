require 'json'
require 'open3'
require_relative './defines'
require_relative './utils'

module FelesBuild
  module Builder
    include Defines
    @logger = FelesBuild::Utils::Logger.new('builder')

    def self.package_version
      JSON.parse(File.read(File.join(Defines::PROJECT_ROOT, 'package.json')))['version']
    end

    def self.run_in_parallel(commands)
      pids = commands.map do |cmd, dir|
        @logger.info "Running `#{cmd.join(' ')}` in `#{dir}`"
        spawn(*cmd, chdir: dir, out: '/dev/null', err: '/dev/null')
      end

      pids.each do |pid|
        Process.wait(pid)
        raise "Build command failed with status #{$?.exitstatus}" unless $?.success?
      end
    end

    def self.run(mode: 'dev', buildid2: 'default-build-id')
      @logger.info "Building features with mode=#{mode}"

      version = package_version

      dev_commands = [
        [['deno', 'task', 'build', mode], File.join(PROJECT_ROOT, 'bridge/startup')],
        [['npx', 'vite', 'build'], File.join(PROJECT_ROOT, 'bridge/loader-modules')],
        [['npx', 'vite', 'build'], File.join(PROJECT_ROOT, 'browser-features/skin')]
      ]

      prod_commands = [
        [['deno', 'task', 'build', mode], File.join(PROJECT_ROOT, 'bridge/startup')],
        [['npx', 'vite', 'build', '--base', 'chrome://noraneko/content'], File.join(PROJECT_ROOT, 'bridge/loader-features')],
        [['npx', 'vite', 'build', '--base', 'resource://noraneko'], File.join(PROJECT_ROOT, 'bridge/loader-modules')],
        [['npx', 'vite', 'build'], File.join(PROJECT_ROOT, 'browser-features/skin')],
        [['npx', 'vite', 'build', '--base', 'chrome://noraneko-settings/content'], File.join(PROJECT_ROOT, 'src/ui/settings')]
      ]

      if mode.start_with?('dev')
        run_in_parallel(dev_commands)
      else
        run_in_parallel(prod_commands)
      end

      @logger.success "Build complete."
    end
  end
end
