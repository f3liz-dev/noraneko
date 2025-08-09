require 'childprocess'
require_relative './defines'

module FelesBuild
  module DevServer
    include Defines
    @logger = FelesBuild::Utils::Logger.new('dev-server')

    def self.run
      @logger.info "Starting Vite dev server..."

      # In a real scenario, we would determine the correct directory
      # for the vite project. For now, let's assume it's the root.
      project_dir = '.'

      process = ChildProcess.build('vite')
      process.cwd = project_dir
      process.io.inherit!
      process.start

      @logger.info "Vite dev server started with PID: #{process.pid}"

      # In a real CLI, we would handle graceful shutdown.
      # For this refactoring, we'll let the user kill the process.
      process.wait
    end
  end
end
