require 'fileutils'
require 'open3'
require_relative './defines'

module FelesBuild
  module Patcher
    include Defines
    @logger = FelesBuild::Utils::Logger.new('patcher')

    PATCHES_DIR = 'tools/build/tasks/git-patches/patches'
    PATCHES_TMP = '_dist/bin/applied_patches'

    def self.bin_dir
      Defines::BIN_DIR
    end

    def self.git_initialized?(dir)
      File.exist?(File.join(dir, '.git'))
    end

    def self.initialize_bin_git
      dir = bin_dir
      if git_initialized?(dir)
        @logger.info 'Git repository is already initialized in _dist/bin.'
        return
      end
      @logger.info 'Initializing Git repository in _dist/bin.'
      FileUtils.mkdir_p(dir)
      File.write(File.join(dir, '.gitignore'), [
        './noraneko-dev/*',
        './browser/chrome/browser/res/activity-stream/data/content/abouthomecache/*'
      ].join("\n"))
      Open3.capture3('git', 'init', chdir: dir)
      Open3.capture3('git', 'add', '.', chdir: dir)
      Open3.capture3('git', 'commit', '-m', 'initialize', chdir: dir)
      @logger.success 'Git repository initialization complete.'
    end

    def self.patch_needed?
      Dir.exist?(PATCHES_DIR) && !Dir.exist?(PATCHES_TMP)
    end

    def self.run
        # For now, we only initialize the git repo.
        # The actual patching logic is not in the original script.
        initialize_bin_git
    end
  end
end
