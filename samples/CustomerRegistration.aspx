<%@ Page Language="C#" AutoEventWireup="true" CodeBehind="CustomerRegistration.aspx.cs" Inherits="Legacy.CustomerRegistration" %>
<!DOCTYPE html>
<html><head runat="server"><title>Customer Registration</title></head>
<body><form id="form1" runat="server">
  <asp:Label ID="lblTitle" runat="server" Text="Customer Registration" />
  <asp:TextBox ID="txtFullName" runat="server" />
  <asp:RequiredFieldValidator ID="reqFullName" runat="server" ControlToValidate="txtFullName" ErrorMessage="Name required" />
  <asp:TextBox ID="txtEmail" runat="server" TextMode="Email" />
  <asp:RequiredFieldValidator ID="reqEmail" runat="server" ControlToValidate="txtEmail" ErrorMessage="Email required" />
  <asp:RegularExpressionValidator ID="validEmail" runat="server" ControlToValidate="txtEmail" ValidationExpression="^[^@]+@[^@]+\.[^@]+$" ErrorMessage="Enter a valid email" />
  <asp:DropDownList ID="ddlRegion" runat="server">
    <asp:ListItem Text="Select region" Value="" />
    <asp:ListItem Text="East" Value="east" />
    <asp:ListItem Text="West" Value="west" />
  </asp:DropDownList>
  <asp:CheckBox ID="chkMarketing" runat="server" Text="Send me updates" />
  <asp:Button ID="btnSubmit" runat="server" Text="Save Customer" OnClick="btnSubmit_Click" />
</form></body></html>