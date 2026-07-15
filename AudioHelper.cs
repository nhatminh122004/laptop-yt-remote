using System;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using System.Net.WebSockets;
using System.Text;

namespace AudioHelper
{
    [ComImport]
    [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDeviceEnumerator
    {
        int EnumAudioEndpoints(int dataFlow, int stateMask, out object ppDevices);
        int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice ppDevice);
        int GetDevice([MarshalAs(UnmanagedType.LPWStr)] string pwstrId, out IMMDevice ppDevice);
        int RegisterEndpointNotificationCallback(IntPtr pClient);
        int UnregisterEndpointNotificationCallback(IntPtr pClient);
    }

    [ComImport]
    [Guid("D66606F3-1587-4E43-81F1-B948E807363F")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDevice
    {
        [PreserveSig]
        int Activate(ref Guid iid, int dwClsCtx, IntPtr pActivationParams, [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);
        [PreserveSig]
        int OpenPropertyStore(int stgmAccess, out IntPtr ppProperties);
        [PreserveSig]
        int GetId([MarshalAs(UnmanagedType.LPWStr)] out string ppstrId);
        [PreserveSig]
        int GetState(out int pdwState);
    }

    [ComImport]
    [Guid("5CDF2C82-841E-4546-9722-0CF74078229A")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioEndpointVolume
    {
        int RegisterControlChangeNotify(IntPtr pNotify);
        int UnregisterControlChangeNotify(IntPtr pNotify);
        int GetChannelCount(out uint pnChannelCount);
        int SetMasterVolumeLevel(float fLevelDB, ref Guid pguidEventContext);
        int SetMasterVolumeLevelScalar(float fLevel, ref Guid pguidEventContext);
        int GetMasterVolumeLevel(out float pfLevelDB);
        int GetMasterVolumeLevelScalar(out float pfLevel);
        int SetChannelVolumeLevel(uint nChannel, float fLevelDB, ref Guid pguidEventContext);
        int SetChannelVolumeLevelScalar(uint nChannel, float fLevel, ref Guid pguidEventContext);
        int GetChannelVolumeLevel(uint nChannel, out float pfLevelDB);
        int GetChannelVolumeLevelScalar(uint nChannel, out float pfLevel);
        int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, ref Guid pguidEventContext);
        int GetMute([MarshalAs(UnmanagedType.Bool)] out bool pbMute);
        int GetVolumeStepInfo(out uint pnStep, out uint pnSteps);
        int VolumeStepUp(ref Guid pguidEventContext);
        int VolumeStepDown(ref Guid pguidEventContext);
        int QueryHardwareSupport(out uint pdwHardwareSupportMask);
    }

    [ComImport]
    [Guid("C02216F6-8C67-4B5B-9D00-D008E73E0064")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioMeterInformation
    {
        [PreserveSig]
        int GetPeakValue(out float pfPeak);
        [PreserveSig]
        int GetMeteringChannelCount(out uint pnChannelCount);
        [PreserveSig]
        int GetChannelsPeakValues(uint u32ChannelCount, [Out] float[] afPeakValues);
        [PreserveSig]
        int QueryHardwareSupport(out uint pdwHardwareSupportMask);
    }

    [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
    class MMDeviceEnumeratorCom { }

    class Program
    {
        static int Main(string[] args)
        {
            if (args.Length == 0)
            {
                PrintUsage();
                return 1;
            }

            try
            {
                // Khởi tạo COM Device Enumerator
                var enumerator = (IMMDeviceEnumerator)Activator.CreateInstance(typeof(MMDeviceEnumeratorCom));
                
                // Lấy thiết bị phát mặc định (eRender = 0, eMultimedia = 1)
                IMMDevice device;
                int hr = enumerator.GetDefaultAudioEndpoint(0, 1, out device);
                if (hr != 0)
                {
                    Console.Error.WriteLine("Error getting default audio endpoint: HRESULT 0x" + hr.ToString("X"));
                    return hr;
                }

                string cmd = args[0].ToLower();

                if (cmd == "get")
                {
                    Guid guid = Guid.Empty;
                    object volumeObj;
                    var volumeGuid = new Guid("5CDF2C82-841E-4546-9722-0CF74078229A");
                    device.Activate(ref volumeGuid, 1, IntPtr.Zero, out volumeObj);
                    var volume = (IAudioEndpointVolume)volumeObj;

                    float level;
                    volume.GetMasterVolumeLevelScalar(out level);
                    bool muted;
                    volume.GetMute(out muted);

                    Console.WriteLine("Volume:" + Math.Round(level * 100) + "|Muted:" + muted);
                    Console.Out.Flush();
                    return 0;
                }
                else if (cmd == "set" && args.Length > 1)
                {
                    float level = float.Parse(args[1]) / 100f;
                    if (level < 0) level = 0;
                    if (level > 1) level = 1;

                    Guid guid = Guid.Empty;
                    object volumeObj;
                    var volumeGuid = new Guid("5CDF2C82-841E-4546-9722-0CF74078229A");
                    device.Activate(ref volumeGuid, 1, IntPtr.Zero, out volumeObj);
                    var volume = (IAudioEndpointVolume)volumeObj;

                    int hrVol = volume.SetMasterVolumeLevelScalar(level, ref guid);
                    if (hrVol != 0)
                    {
                        Console.Error.WriteLine("Error setting volume: HRESULT 0x" + hrVol.ToString("X"));
                        return hrVol;
                    }
                    Console.WriteLine("Volume set to " + Math.Round(level * 100) + "%");
                    Console.Out.Flush();
                    return 0;
                }
                else if (cmd == "mute" && args.Length > 1)
                {
                    string state = args[1].ToLower();
                    Guid guid = Guid.Empty;
                    object volumeObj;
                    var volumeGuid = new Guid("5CDF2C82-841E-4546-9722-0CF74078229A");
                    device.Activate(ref volumeGuid, 1, IntPtr.Zero, out volumeObj);
                    var volume = (IAudioEndpointVolume)volumeObj;

                    bool currentMute;
                    volume.GetMute(out currentMute);

                    bool targetMute = currentMute;
                    if (state == "1" || state == "true" || state == "on") targetMute = true;
                    else if (state == "0" || state == "false" || state == "off") targetMute = false;
                    else if (state == "toggle") targetMute = !currentMute;

                    volume.SetMute(targetMute, ref guid);
                    Console.WriteLine("Muted:" + targetMute);
                    Console.Out.Flush();
                    return 0;
                }
                else if (cmd == "stream")
                {
                    int interval = 33;
                    if (args.Length > 1)
                    {
                        int.TryParse(args[1], out interval);
                        if (interval < 5) interval = 5;
                    }

                    object meterObj;
                    var meterGuid = new Guid("C02216F6-8C67-4B5B-9D00-D008E73E0064");
                    int hrMeterActivate = device.Activate(ref meterGuid, 1, IntPtr.Zero, out meterObj);
                    if (hrMeterActivate != 0)
                    {
                        Console.Error.WriteLine("Error activating IAudioMeterInformation: HRESULT 0x" + hrMeterActivate.ToString("X"));
                        return hrMeterActivate;
                    }
                    var meter = (IAudioMeterInformation)meterObj;

                    while (true)
                    {
                        float peak;
                        int hrMeter = meter.GetPeakValue(out peak);
                        if (hrMeter == 0) Console.WriteLine(peak.ToString("0.000"));
                        else Console.WriteLine("-1.000");
                        Console.Out.Flush();
                        Thread.Sleep(interval);
                    }
                }
                else if (cmd == "connect" && args.Length > 1)
                {
                    string wsUrl = args[1];
                    Console.WriteLine("Connecting to Cloud Server at: " + wsUrl);
                    
                    // Khởi chạy vòng lặp Client WebSocket
                    RunWebSocketClient(wsUrl, device).Wait();
                    return 0;
                }
                else
                {
                    PrintUsage();
                    return 1;
                }
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error: " + ex.Message);
                return -1;
            }
        }

        static async Task RunWebSocketClient(string url, IMMDevice device)
        {
            var volumeGuid = new Guid("5CDF2C82-841E-4546-9722-0CF74078229A");
            object volumeObj;
            device.Activate(ref volumeGuid, 1, IntPtr.Zero, out volumeObj);
            var volume = (IAudioEndpointVolume)volumeObj;

            var meterGuid = new Guid("C02216F6-8C67-4B5B-9D00-D008E73E0064");
            object meterObj;
            device.Activate(ref meterGuid, 1, IntPtr.Zero, out meterObj);
            var meter = (IAudioMeterInformation)meterObj;

            while (true)
            {
                using (var ws = new ClientWebSocket())
                {
                    try
                    {
                        Console.WriteLine("[WS] Connecting to " + url + "...");
                        await ws.ConnectAsync(new Uri(url), CancellationToken.None);
                        Console.WriteLine("[WS] Connected successfully!");

                        // Phát trạng thái âm lượng hiện tại khi vừa kết nối xong
                        await SendVolumeStatus(ws, volume);

                        var cts = new CancellationTokenSource();
                        // Chạy Task gửi peak level trong background
                        var sendPeakTask = Task.Run(async () => {
                            try
                            {
                                while (ws.State == WebSocketState.Open)
                                {
                                    float peak;
                                    int hr = meter.GetPeakValue(out peak);
                                    if (hr == 0)
                                    {
                                        string peakJson = "{\"type\":\"audio-peak\",\"data\":" + peak.ToString("0.000", System.Globalization.CultureInfo.InvariantCulture) + "}";
                                        byte[] bytes = Encoding.UTF8.GetBytes(peakJson);
                                        await ws.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None);
                                    }
                                    await Task.Delay(50); // Gửi mỗi 50ms (~20fps) để cân bằng hiệu suất và băng thông
                                }
                            }
                            catch (Exception ex)
                            {
                                Console.WriteLine("[WS Send Peak Error] " + ex.Message);
                            }
                        }, cts.Token);

                        // Vòng lặp nhận dữ liệu (lệnh điều khiển âm lượng từ đám mây)
                        byte[] buffer = new byte[4096];
                        while (ws.State == WebSocketState.Open)
                        {
                            var result = await ws.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
                            if (result.MessageType == WebSocketMessageType.Close)
                            {
                                await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "Closing", CancellationToken.None);
                                break;
                            }

                            string msg = Encoding.UTF8.GetString(buffer, 0, result.Count);
                            Console.WriteLine("[WS Command Received] " + msg);

                            try
                            {
                                Guid guid = Guid.Empty;

                                // Lệnh hỏi âm lượng
                                if (msg.Contains("get-volume") || msg.Contains("request-status"))
                                {
                                    await SendVolumeStatus(ws, volume);
                                }
                                // Lệnh đặt mức âm lượng
                                else if (msg.Contains("\"action\":\"set\"") || msg.Contains("\"action\": \"set\""))
                                {
                                    var match = System.Text.RegularExpressions.Regex.Match(msg, @"\""value\""\s*:\s*(\d+)");
                                    if (match.Success)
                                    {
                                        float level = float.Parse(match.Groups[1].Value) / 100f;
                                        if (level < 0) level = 0;
                                        if (level > 1) level = 1;
                                        volume.SetMasterVolumeLevelScalar(level, ref guid);

                                        await SendVolumeStatus(ws, volume);
                                    }
                                }
                                // Lệnh tắt/bật tiếng (Mute)
                                else if (msg.Contains("\"action\":\"mute\"") || msg.Contains("\"action\": \"mute\""))
                                {
                                    var match = System.Text.RegularExpressions.Regex.Match(msg, @"\""value\""\s*:\s*\""([^\""]+)\""");
                                    string val = match.Success ? match.Groups[1].Value : "toggle";

                                    bool currentMute;
                                    volume.GetMute(out currentMute);
                                    bool targetMute = currentMute;

                                    if (val == "1" || val == "true" || val == "on") targetMute = true;
                                    else if (val == "0" || val == "false" || val == "off") targetMute = false;
                                    else if (val == "toggle") targetMute = !currentMute;

                                    volume.SetMute(targetMute, ref guid);
                                    await SendVolumeStatus(ws, volume);
                                }
                            }
                            catch (Exception ex)
                            {
                                Console.WriteLine("[WS Command Run Error] " + ex.Message);
                            }
                        }
                        cts.Cancel();
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine("[WS Error] " + ex.Message);
                    }
                }

                Console.WriteLine("[WS] Disconnected from server. Reconnecting in 3 seconds...");
                await Task.Delay(3000);
            }
        }

        static async Task SendVolumeStatus(ClientWebSocket ws, IAudioEndpointVolume volume)
        {
            if (ws.State != WebSocketState.Open) return;

            float level;
            volume.GetMasterVolumeLevelScalar(out level);
            bool muted;
            volume.GetMute(out muted);

            int volPercent = (int)Math.Round(level * 100);
            string volJson = "{\"type\":\"volume-status\",\"data\":{\"volume\":" + volPercent + ",\"muted\":" + (muted ? "true" : "false") + "}}";
            byte[] volBytes = Encoding.UTF8.GetBytes(volJson);
            await ws.SendAsync(new ArraySegment<byte>(volBytes), WebSocketMessageType.Text, true, CancellationToken.None);
        }

        static void PrintUsage()
        {
            Console.WriteLine("Usage:");
            Console.WriteLine("  AudioHelper.exe get");
            Console.WriteLine("  AudioHelper.exe set <0-100>");
            Console.WriteLine("  AudioHelper.exe mute <1|0|toggle>");
            Console.WriteLine("  AudioHelper.exe stream [interval_ms]");
            Console.WriteLine("  AudioHelper.exe connect <ws_url>");
        }
    }
}
