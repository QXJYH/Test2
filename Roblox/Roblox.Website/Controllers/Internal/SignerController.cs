using Microsoft.AspNetCore.Mvc;
using System.Security.Cryptography;
using System.Text;
using Newtonsoft.Json;

namespace Roblox.Website.Controllers.Internal
{
    public class SignatureController : ControllerBase
    {
        private static RSACryptoServiceProvider? _rsaCsp;
        private static SHA1? _shaCsp;
        
        public static void Setup()
        {
            try
            {
                byte[] privateKeyBlob = Convert.FromBase64String(System.IO.File.ReadAllText("PrivateKeyBlob.txt"));
                
                _shaCsp = SHA1.Create();
                _rsaCsp = new RSACryptoServiceProvider();
                
                _rsaCsp.ImportCspBlob(privateKeyBlob);
            }
            catch (Exception ex)
            {
                throw new Exception("Error setting up SignatureController: " + ex.Message);
            }
        }

        public static string SignJsonResponseForClientFromPrivateKey(dynamic JSONToSign)
        {
            string format = "--rbxsig%{0}%{1}";

            string json = JsonConvert.SerializeObject(JSONToSign);
            string script = Environment.NewLine + json;
            byte[] signature = _rsaCsp!.SignData(Encoding.Default.GetBytes(script), _shaCsp!);

            return String.Format(format, Convert.ToBase64String(signature), script);
        }

public static string SignStringResponseForClientFromPrivateKey(string stringToSign, bool bUseRbxSig = false)
{
    SignatureController.Setup();
    if (string.IsNullOrEmpty(stringToSign))
    {
        Console.WriteLine("[ERROR] The string to sign is null or empty.");
        return string.Empty;
    }

    // Check if RSACryptoServiceProvider (_rsaCsp) is initialized
    if (_rsaCsp == null)
    {
        Console.WriteLine("[ERROR] RSACryptoServiceProvider is not initialized.");
        Console.WriteLine("[DEBUG] Please ensure the SignatureController.Setup() method is called at the start of the application.");
        return string.Empty;
    }

    // Debugging: Log private key status
    try
    {
        // Attempt to sign data to check the RSA provider's functionality
        byte[] testData = Encoding.Default.GetBytes("test");
        byte[] testSignature = _rsaCsp.SignData(testData, _shaCsp);
        Console.WriteLine("[DEBUG] Private key is properly initialized and can sign data.");
    }
    catch (Exception ex)
    {
        Console.WriteLine("[ERROR] Failed to test signing operation. Exception: " + ex.Message);
        return string.Empty;
    }

    if (bUseRbxSig)
    {
        string format = "--rbxsig%{0}%{1}";

        // Attempt signing the actual data
        try
        {
            byte[] signature = _rsaCsp.SignData(Encoding.Default.GetBytes(stringToSign), _shaCsp);
            string script = Environment.NewLine + stringToSign;

            Console.WriteLine("[DEBUG] Signing successful using the provided string.");
            return String.Format(format, Convert.ToBase64String(signature), script);
        }
        catch (Exception ex)
        {
            Console.WriteLine("[ERROR] Error while signing data with RSA: " + ex.Message);
            return string.Empty;
        }
    }
    else
    {
        // Sign the string without using rbxsig format
        try
        {
            byte[] signature = _rsaCsp.SignData(Encoding.Default.GetBytes(stringToSign), _shaCsp);
            Console.WriteLine("[DEBUG] Signing successful without rbxsig format.");
            return Convert.ToBase64String(signature);
        }
        catch (Exception ex)
        {
            Console.WriteLine("[ERROR] Error while signing data with RSA: " + ex.Message);
            return string.Empty;
        }
    }
}
}
}