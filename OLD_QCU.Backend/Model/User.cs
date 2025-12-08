using System.ComponentModel.DataAnnotations;

namespace QCU.Backend.Models
{
    public class User
    {
        [Key]
        public int UserId { get; set; }
        public string StudentNumber { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string PasswordHash { get; set; } = string.Empty;
        public string Role { get; set; } = "BUYER"; // Options: BUYER, VENDOR, ADMIN
        public DateTime CreatedAt { get; set; }
    }
}