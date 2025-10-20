using System.Reflection;
using System.Runtime.InteropServices;
using System.Windows;

// 
// 统一版本号管理 - 所有版本信息都从VersionInfo.cs中获取
// 修改版本号时，只需要更新VersionInfo.cs文件即可
//

// General Information about an assembly is controlled through the following
// set of attributes. Change these attribute values to modify the information
// associated with an assembly.
[assembly: AssemblyTitle(V2rayClient.VersionInfo.ApplicationName)]
[assembly: AssemblyDescription(V2rayClient.VersionInfo.Description)]
[assembly: AssemblyConfiguration("")]
[assembly: AssemblyCompany(V2rayClient.VersionInfo.Company)]
[assembly: AssemblyProduct(V2rayClient.VersionInfo.ApplicationName)]
[assembly: AssemblyCopyright(V2rayClient.VersionInfo.Copyright)]
[assembly: AssemblyTrademark("")]
[assembly: AssemblyCulture("")]

// Setting ComVisible to false makes the types in this assembly not visible
// to COM components.  If you need to access a type in this assembly from
// COM, set the ComVisible attribute to true on that type.
[assembly: ComVisible(false)]

// The following GUID is for the ID of the typelib if this project is exposed to COM
[assembly: Guid("a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d")]

// ThemeInfo describes where theme specific and generic resource dictionaries can be found.
[assembly: ThemeInfo(
    ResourceDictionaryLocation.None, // where theme specific resource dictionaries are located
                                     // (used if a resource is not found in the page,
                                     // or application resource dictionaries)
    ResourceDictionaryLocation.SourceAssembly // where the generic resource dictionary is located
                                              // (used if a resource is not found in the page,
                                              // app, or any theme specific resource dictionaries)
)]
