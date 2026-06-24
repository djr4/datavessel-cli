class Datavessel < Formula
  desc "Run 100+ analytics and commerce tools from your terminal"
  homepage "https://datavessel.io"
  url "https://registry.npmjs.org/datavessel-cli/-/datavessel-cli-0.1.0.tgz"
  sha256 "0200e4e35ad07c73b6b434dd320d1776f3491fa79fb9fdc19abe706f579f13ff"
  license "Apache-2.0"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    # Links both the `datavessel` and `dv` commands declared in package.json#bin.
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    assert_match "0.1.0", shell_output("#{bin}/datavessel --version")
  end
end
