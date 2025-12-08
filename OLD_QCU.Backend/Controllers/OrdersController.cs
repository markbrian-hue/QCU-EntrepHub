using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QCU.Backend.Data;
using QCU.Backend.Models;
using QCU.Backend.DTOs;

namespace QCU.Backend.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class OrdersController : ControllerBase
    {
        private readonly AppDbContext _context;

        public OrdersController(AppDbContext context)
        {
            _context = context;
        }

        // POST: api/orders
        // This is the "Checkout" button
        [HttpPost]
        public async Task<IActionResult> PlaceOrder([FromBody] CreateOrderDto request)
        {
            // 1. Validate the Request
            if (request.Items == null || request.Items.Count == 0)
                return BadRequest("Order must contain at least one item.");

            // 2. Prepare the Order Object
            var newOrder = new Order
            {
                CustomerId = request.CustomerUserId,
                VendorId = request.VendorId,
                DeliveryLocation = request.DeliveryLocation,
                PaymentMethod = request.PaymentMethod,
                Status = "PENDING",
                CreatedAt = DateTime.UtcNow,
                TotalAmount = 0 // We will calculate this below
            };

            // 3. Process Items & Calculate Total Price
            // We fetch the REAL price from the database to prevent hacking
            decimal calculatedTotal = 0;

            foreach (var itemDto in request.Items)
            {
                var product = await _context.Products.FindAsync(itemDto.ProductId);
                
                if (product == null)
                    return BadRequest($"Product ID {itemDto.ProductId} not found.");

                // Create the Order Item record
                var orderItem = new OrderItem
                {
                    Product = product, // Link to existing product
                    Quantity = itemDto.Quantity,
                    PriceAtOrder = product.Price // Save the price at this moment
                };

                // Add to list and update total
                // Note: In real EF Core, we add to the context directly or via navigation prop
                // For simplicity here, we will save the order first then the items
                
                calculatedTotal += (product.Price * itemDto.Quantity);
                
                // Add item to context linked to this order
                 _context.Add(new OrderItem 
                 { 
                     Order = newOrder, // Link to the new order
                     ProductId = product.ProductId,
                     Quantity = itemDto.Quantity,
                     PriceAtOrder = product.Price
                 });
            }

            newOrder.TotalAmount = calculatedTotal;

            // 4. Save everything to Database
            _context.Orders.Add(newOrder);
            await _context.SaveChangesAsync();

            return StatusCode(201, new { Message = "Order placed successfully!", OrderId = newOrder.OrderId, Total = calculatedTotal });
        }

        // GET: api/orders/vendor/1
        // This allows the "Truffle Kings" student to see their orders
        [HttpGet("vendor/{vendorId}")]
        public async Task<IActionResult> GetVendorOrders(int vendorId)
        {
            var orders = await _context.Orders
                .Where(o => o.VendorId == vendorId)
                .Include(o => o.Customer) // Include Buyer Name
                .OrderByDescending(o => o.CreatedAt)
                .ToListAsync();

            return Ok(orders);
        }

        [HttpPut("{orderId}/status")]
public async Task<IActionResult> UpdateOrderStatus(int orderId, [FromBody] string newStatus)
{
    var order = await _context.Orders.FindAsync(orderId);
    if (order == null) return NotFound();

    order.Status = newStatus; // e.g., "READY", "COMPLETED", "CANCELLED"
    await _context.SaveChangesAsync();

    return Ok(new { message = "Order status updated", status = newStatus });
}
    }
}