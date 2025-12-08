using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QCU.Backend.Data;
using QCU.Backend.Models;
using QCU.Backend.DTOs;
using System.Security.Cryptography;
using System.Text;

namespace QCU.Backend.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UsersController : ControllerBase
    {
        private readonly AppDbContext _context;

        public UsersController(AppDbContext context)
        {
            _context = context;
        }

        // POST: api/users/register
        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequestDto request)
        {
            // 1. Check for existing student number
            if (await _context.Users.AnyAsync(u => u.StudentNumber == request.StudentNumber))
            {
                return BadRequest("Student Number is already registered.");
            }

            // 2. Hash Password (Simple SHA256 for portfolio)
            using var sha256 = SHA256.Create();
            var hashedBytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(request.Password));
            var passwordHash = BitConverter.ToString(hashedBytes).Replace("-", "").ToLowerInvariant();

            // 3. Create User record
            var user = new User
            {
                StudentNumber = request.StudentNumber,
                FullName = request.FullName,
                PasswordHash = passwordHash,
                Role = request.Role.ToUpper() == "VENDOR" ? "VENDOR" : "BUYER",
                CreatedAt = DateTime.UtcNow
            };

            await _context.Users.AddAsync(user);
            await _context.SaveChangesAsync();

            // 4. If VENDOR, create the Shop/Vendor profile immediately
            if (user.Role == "VENDOR")
            {
                var vendor = new Vendor
                {
                    UserId = user.UserId,
                    ShopName = request.ShopName,
                    CourseSection = request.CourseSection,
                    IsOpen = false // Defaults to closed
                };
                await _context.Vendors.AddAsync(vendor);
                await _context.SaveChangesAsync();
            }
            
            return StatusCode(201, "User registered successfully.");
        }
        
        // POST: api/users/login
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] RegisterRequestDto request)
        {
            // 1. Find the user
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.StudentNumber == request.StudentNumber);

            if (user == null)
            {
                return Unauthorized("Invalid Student Number or Password.");
            }
            
            // 2. Hash incoming password to compare
            using var sha256 = SHA256.Create();
            var hashedBytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(request.Password));
            var inputPasswordHash = BitConverter.ToString(hashedBytes).Replace("-", "").ToLowerInvariant();

            // 3. Compare hashes
            if (user.PasswordHash != inputPasswordHash)
            {
                return Unauthorized("Invalid Student Number or Password.");
            }

            // 4. Check for Vendor Profile (The Update)
            // We need to know if this user has a shop so the dashboard works
            var vendor = await _context.Vendors.FirstOrDefaultAsync(v => v.UserId == user.UserId);

            // 5. Return everything the frontend needs
            return Ok(new 
            { 
                user.UserId, 
                user.FullName, 
                user.StudentNumber, 
                user.Role,
                // These will be null if the user is just a Buyer, which is fine
                VendorId = vendor?.VendorId, 
                ShopName = vendor?.ShopName 
            });
        }
    }
}