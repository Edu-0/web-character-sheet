using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Text;

internal static class Generator {
    private static string Quote(string value) {
        value = value.Replace("\"", "");
        int trailing = value.Length - value.TrimEnd('\\').Length;
        return "\"" + value + new string('\\', trailing) + "\"";
    }
    [STAThread]
    private static int Main(string[] args) {
        Console.OutputEncoding = Encoding.UTF8;
        bool unattended = Array.IndexOf(args, "--non-interactive") >= 0;
        string output = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Ficha RPG Gerados");
        string source = null;
        for (int i = 0; i < args.Length; i++) {
            if ((args[i] == "--output" || args[i] == "--source") && i + 1 < args.Length) {
                string option = args[i++];
                if (option == "--output") output = Path.GetFullPath(args[i]); else source = Path.GetFullPath(args[i]);
            } else if (args[i] != "--non-interactive") {
                Console.Error.WriteLine("Uso: Gerar-Ficha-RPG.exe [--output pasta] [--source pasta-local] [--non-interactive]");
                return 2;
            }
        }
        string temporary = Path.Combine(Path.GetTempPath(), "ficha-generator-" + Guid.NewGuid().ToString("N"));
        int result = 1;
        try {
            Directory.CreateDirectory(temporary);
            string script = Path.Combine(temporary, "generate.ps1");
            using (Stream input = Assembly.GetExecutingAssembly().GetManifestResourceStream("generate.ps1"))
            using (FileStream target = File.Create(script)) input.CopyTo(target);
            Console.WriteLine("Ficha RPG - Gerador de executáveis Windows\nA primeira geração baixa as ferramentas. Internet necessária.\nDestino: " + output + "\n");
            string arguments = "-NoLogo -NoProfile -ExecutionPolicy Bypass -File " + Quote(script) + " -OutputRoot " + Quote(output);
            if (source != null) arguments += " -SourceDirectory " + Quote(source);
            if (unattended) arguments += " -NoOpen";
            var start = new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "WindowsPowerShell\\v1.0\\powershell.exe"), arguments);
            start.UseShellExecute = false;
            using (Process child = Process.Start(start)) { child.WaitForExit(); result = child.ExitCode; }
            Console.WriteLine(result == 0 ? "\nGeração concluída." : "\nA geração falhou. O log na pasta de destino contém os detalhes.");
        } catch (Exception error) { Console.Error.WriteLine(error.Message); }
        finally {
            // Delete only our own unique embedded-script file, never source/output trees.
            string script = Path.Combine(temporary, "generate.ps1");
            if (File.Exists(script)) File.Delete(script);
            if (Directory.Exists(temporary)) Directory.Delete(temporary, false);
        }
        if (!unattended && !Console.IsInputRedirected) { Console.WriteLine("Pressione uma tecla para fechar."); Console.ReadKey(true); }
        return result;
    }
}
