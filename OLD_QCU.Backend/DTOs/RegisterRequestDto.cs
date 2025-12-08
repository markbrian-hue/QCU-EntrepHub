namespace QCU.Backend.DTOs
{
    public class RegisterRequestDto
    {
        public string FullName { get; set; } = string.Empty;
        public string StudentNumber { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string Role { get; set; } = "BUYER"; // Default role
        public string ShopName { get; set; } = string.Empty; // Used only if role is VENDOR
        public string CourseSection { get; set; } = string.Empty; // Used only if role is VENDOR
    }
}