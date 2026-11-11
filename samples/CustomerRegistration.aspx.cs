using System;
using System.Web.UI;
namespace Legacy {
  public partial class CustomerRegistration : Page {
    protected void Page_Load(object sender, EventArgs e) { if (!IsPostBack) { } }
    protected void btnSubmit_Click(object sender, EventArgs e) {
      // Business logic: validate customer, persist to SQL Server, trigger email.
      SaveCustomer(txtFullName.Text, txtEmail.Text);
    }
    private void SaveCustomer(string name, string email) { }
  }
}