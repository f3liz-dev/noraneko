require 'json'
require_relative './defines'

module FelesBuild
  module Builder
    include Defines
    @logger = FelesBuild::Utils::Logger.new('builder')

    def self.package_version
      JSON.parse(File.read(File.join(Defines::PROJECT_ROOT, 'package.json')))['version']
    end

    def self.run_command(cmd, dir)
      system(*cmd, chdir: dir)
    end

    def self.run(mode: 'dev', buildid2: 'default-build-id')
      @logger.info "Building features with mode=#{mode}"

      run_command(['deno', 'task', 'build', "--env.MODE=#{mode}"], Defines::PATHS[:startup])
      run_command(['deno', 'task', 'build', "--env.__BUILDID2__=#{buildid2}", "--env.__VERSION2__=#{package_version}"], Defines::PATHS[:loader_modules])

      @logger.success "Build complete."
    end
  end
end
